"""
Import service for Claude conversations in their native export format,
as sent by the browser extension. Handles deduplication, message normalization,
and S3 storage of any extension-attached image bytes.
"""
import base64
import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID, uuid4

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from Cal_Backend.db.models import (
    Conversation,
    Media,
    MediaType,
    MessageRole,
    NotebookSource,
    Note,
    User,
    ContentType,
)
from Cal_Backend.storage.s3 import upload_media_bytes
from .schemas import (
    ClaudeAttachment,
    ClaudeChatMessage,
    ClaudeNativeConversation,
)

logger = logging.getLogger(__name__)


# ────────────────────────── helpers ──────────────────────────

def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _flatten_message_text(msg: ClaudeChatMessage) -> str:
    """Reassemble message text from content blocks, falling back to msg.text."""
    parts = []
    for block in msg.content:
        if block.type == "text" and block.text:
            parts.append(block.text)
    if parts:
        return "\n".join(parts)
    return msg.text or ""


def _normalize_role(sender: str) -> MessageRole:
    """Claude uses 'human'/'assistant'; your model uses USER/ASSISTANT/NOTE."""
    if sender == "human":
        return MessageRole.USER
    if sender == "assistant":
        return MessageRole.ASSISTANT
    return MessageRole.NOTE


def _ext_from_mime(mime: Optional[str]) -> str:
    if not mime:
        return "bin"
    m = mime.lower()
    if "png" in m: return "png"
    if "jpeg" in m or "jpg" in m: return "jpg"
    if "webp" in m: return "webp"
    if "gif" in m: return "gif"
    return "bin"


def _media_type_from_mime(mime: str) -> MediaType:
    m = (mime or "").lower()
    if m.startswith("image/"): return MediaType.IMAGE
    if m.startswith("video/"): return MediaType.VIDEO
    if m.startswith("audio/"): return MediaType.AUDIO
    return MediaType.DOCUMENT


# ────────────────────────── service ──────────────────────────

class ClaudeExtensionImportService:
    """
    Imports Claude conversations from native export shape.
    Deduplicates by (user_id, original_conversation_id): if a conversation with
    the same Claude uuid already exists for this user, all child Notes are
    deleted and recreated fresh. Otherwise create new.
    """

    def __init__(self, session: AsyncSession, user: User):
        self.session = session
        self.user = user

    async def import_conversations(
        self,
        conversations: List[ClaudeNativeConversation],
    ) -> dict:
        stats = {
            "conversations_created": 0,
            "conversations_updated": 0,
            "notes_created": 0,
            "media_created": 0,
            "errors": [],
        }

        for native in conversations:
            try:
                created_new, n_notes, n_media = await self._import_one(native)
                if created_new:
                    stats["conversations_created"] += 1
                else:
                    stats["conversations_updated"] += 1
                stats["notes_created"] += n_notes
                stats["media_created"] += n_media
            except Exception as exc:
                logger.error(f"Failed to import conversation {native.uuid}: {exc}", exc_info=True)
                stats["errors"].append({
                    "conversation_uuid": native.uuid,
                    "error": str(exc),
                })

        await self.session.commit()
        return stats

    async def _import_one(
        self,
        native: ClaudeNativeConversation,
    ) -> Tuple[bool, int, int]:
        """
        Returns (created_new, notes_created, media_created).
        """
        # Look up existing conversation by external id
        result = await self.session.execute(
            select(Conversation).where(
                Conversation.user_id == self.user.id,
                Conversation.original_conversation_id == native.uuid,
            )
        )
        existing = result.scalar_one_or_none()

        account_str = ""
        if native.account:
            account_str = native.account.email_address or native.account.uuid or ""

        if existing:
            conv = existing
            conv.title = native.name or conv.title
            conv.account = account_str or conv.account or ""
            conv.updated_at = _parse_iso(native.updated_at) or _now()
            created_new = False
            
            # Delete existing notes for this conversation (cascade also clears media)
            old_notes_res = await self.session.execute(
                select(Note).where(Note.conversation_id == conv.id)
            )
            for old in old_notes_res.scalars().all():
                await self.session.delete(old)
            await self.session.flush()
        else:
            conv = Conversation(
                id=uuid4(),
                user_id=self.user.id,
                title=native.name or "Untitled Conversation",
                source=NotebookSource.CLAUDE,
                account=account_str,
                original_conversation_id=native.uuid,
                created_at=_parse_iso(native.created_at) or _now(),
                updated_at=_parse_iso(native.updated_at) or _now(),
            )
            self.session.add(conv)
            await self.session.flush()
            created_new = True

        # Create notes (one per message)
        notes_created = 0
        media_created = 0
        for native_msg in native.chat_messages:
            note_row, n_media = await self._import_message(conv, native_msg)
            if note_row is not None:
                notes_created += 1
                media_created += n_media

        return created_new, notes_created, media_created

    async def _import_message(
        self,
        conv: Conversation,
        native_msg: ClaudeChatMessage,
    ) -> Tuple[Optional[Note], int]:
        text = _flatten_message_text(native_msg)
        has_attachments = bool(native_msg.attachments) or bool(native_msg.files)

        # Skip completely empty messages
        if not text.strip() and not has_attachments:
            return None, 0

        # Try to map parent uuid → existing note UUID (if we just created it).
        # Since we recreate notes fresh on every import, parent IDs from Claude
        # won't match note IDs we generate. For now, store the Claude-side parent
        # uuid as a string in notemetadata for traceability.
        notemetadata = {}
        if native_msg.uuid:
            notemetadata["claude_message_uuid"] = native_msg.uuid
        if native_msg.parent_message_uuid:
            notemetadata["claude_parent_uuid"] = native_msg.parent_message_uuid

        # Citations: if any content block had them, accumulate
        citations = []
        for block in native_msg.content:
            if block.citations:
                citations.extend(block.citations)
        if citations:
            notemetadata["citations"] = citations

        timestamp = _parse_iso(native_msg.created_at) or _now()

        note = Note(
            id=uuid4(),
            user_id=self.user.id,
            conversation_id=conv.id,
            content=text,
            content_type=ContentType.TEXT,
            role=_normalize_role(native_msg.sender),
            timestamp=timestamp,
            created_at=_now(),
            updated_at=_now(),
            notemetadata=notemetadata,
            title="",  # Note.title is nullable=True but Field default is nothing
        )
        self.session.add(note)
        await self.session.flush()

        # Process attachments
        media_count = 0
        all_atts = list(native_msg.attachments) + list(native_msg.files)
        for pos, att in enumerate(all_atts):
            media_id = await self._maybe_save_attachment(att, note, position_index=pos)
            if media_id:
                media_count += 1

        return note, media_count

    async def _maybe_save_attachment(
        self,
        att: ClaudeAttachment,
        note: Note,
        position_index: int = 0,
    ) -> Optional[UUID]:
        """
        Decode extension-attached base64 bytes, upload to S3, and persist a Media row.
        Returns the new Media.id, or None if there were no bytes or upload failed.
        """
        if not att.extension_data or not att.extension_data.data:
            return None

        raw = att.extension_data.data
        prefix, b64 = (raw.split(",", 1) if "," in raw else ("", raw))

        try:
            binary = base64.b64decode(b64)
        except Exception as exc:
            logger.warning(f"Failed to decode attachment for note {note.id}: {exc}")
            return None

        mime = att.file_type
        if not mime and prefix:
            mime = prefix.split(":", 1)[-1].split(";", 1)[0]
        mime = mime or "application/octet-stream"

        ext = _ext_from_mime(mime)
        s3_key = f"conversations/{note.conversation_id}/{uuid4().hex}.{ext}"

        try:
            await upload_media_bytes(binary, s3_key, mime)
        except Exception as exc:
            logger.error(f"S3 upload failed for note {note.id}: {exc}", exc_info=True)
            return None

        media = Media(
            id=uuid4(),
            user_id=self.user.id,
            note_id=note.id,
            file_path=s3_key,
            file_type=_media_type_from_mime(mime),
            file_size=len(binary),
            mime_type=mime,
            original_filename=att.file_name or f"attachment-{uuid4().hex[:8]}.{ext}",
            position_index=position_index,
        )
        self.session.add(media)
        await self.session.flush()
        return media.id