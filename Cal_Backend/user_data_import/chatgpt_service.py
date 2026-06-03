"""
Import service for ChatGPT conversations in the clean schema.
Mirrors ClaudeExtensionImportService. Handles three image-resolution shapes:

  1. already_in_s3=True              → record S3 key, no upload
  2. data:image/...;base64,...       → decode + upload (future extension)
  3. https://allowlisted-host/...    → fetch + upload (external normalizers)
"""
import asyncio
import base64
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from uuid import UUID, uuid4

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from Cal_Backend.db.models import (
    Conversation,
    ContentType,
    Media,
    MediaType,
    MessageRole,
    NotebookSource,
    Note,
    User,
)
from Cal_Backend.storage.s3 import upload_media_bytes
from .schemas import ChatGPTConversation, ChatGPTMessage

logger = logging.getLogger(__name__)


# Hostnames we're willing to fetch image bytes from inline. Anything else is
# refused — this is the SSRF defense for the /chatgpt/ingest path when a
# third-party normalizer hands us URLs.
_FETCH_ALLOWLIST = {
    "files.oaiusercontent.com",
    "cdn.openai.com",
    "openai-api-files-prod.azureedge.net",
}
_FETCH_TIMEOUT_SEC = 10
_MAX_FETCH_BYTES = 25 * 1024 * 1024  # 25 MB


# ─────────────────────────── helpers ────────────────────────────

def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_role(role: str) -> MessageRole:
    r = (role or "").lower()
    if r == "user":      return MessageRole.USER
    if r == "assistant": return MessageRole.ASSISTANT
    return MessageRole.NOTE


def _media_type_from_mime(mime: str) -> MediaType:
    m = (mime or "").lower()
    if m.startswith("image/"): return MediaType.IMAGE
    if m.startswith("video/"): return MediaType.VIDEO
    if m.startswith("audio/"): return MediaType.AUDIO
    return MediaType.DOCUMENT


def _ext_from_mime(mime: Optional[str]) -> str:
    m = (mime or "").lower()
    if "png" in m:  return "png"
    if "jpeg" in m or "jpg" in m: return "jpg"
    if "webp" in m: return "webp"
    if "gif" in m:  return "gif"
    return "bin"


# ─────────────────────────── service ────────────────────────────

class ChatGPTImportService:
    def __init__(self, session: AsyncSession, user: User):
        self.session = session
        self.user = user

    async def import_conversations(
        self,
        conversations: List[ChatGPTConversation],
    ) -> Dict[str, Any]:
        stats: Dict[str, Any] = {
            "conversations_created": 0,
            "conversations_updated": 0,
            "notes_created":         0,
            "media_created":         0,
            "errors":                [],
        }
        for conv_in in conversations:
            try:
                created_new, n_notes, n_media = await self._import_one(conv_in)
                if created_new:
                    stats["conversations_created"] += 1
                else:
                    stats["conversations_updated"] += 1
                stats["notes_created"] += n_notes
                stats["media_created"] += n_media
            except Exception as exc:
                logger.error(
                    "Failed to import ChatGPT conversation %s: %s",
                    conv_in.id, exc, exc_info=True,
                )
                stats["errors"].append({
                    "conversation_id": conv_in.id,
                    "error":           str(exc),
                })

        await self.session.commit()
        return stats

    async def _import_one(
        self,
        conv_in: ChatGPTConversation,
    ) -> Tuple[bool, int, int]:
        result = await self.session.execute(
            select(Conversation).where(
                Conversation.user_id == self.user.id,
                Conversation.original_conversation_id == conv_in.id,
            )
        )
        existing = result.scalar_one_or_none()
        account_str = conv_in.account or getattr(self.user, "email", "") or ""

        if existing:
            conv = existing
            conv.title = conv_in.title or conv.title
            conv.account = account_str or conv.account or ""
            conv.updated_at = _parse_iso(conv_in.updated_at) or _now()
            created_new = False

            old_notes = await self.session.execute(
                select(Note).where(Note.conversation_id == conv.id)
            )
            for old in old_notes.scalars().all():
                await self.session.delete(old)
            await self.session.flush()
        else:
            conv = Conversation(
                id=uuid4(),
                user_id=self.user.id,
                title=conv_in.title or "Untitled ChatGPT Conversation",
                source=NotebookSource.CHATGPT,
                account=account_str,
                original_conversation_id=conv_in.id,
                created_at=_parse_iso(conv_in.created_at) or _now(),
                updated_at=_parse_iso(conv_in.updated_at) or _now(),
            )
            self.session.add(conv)
            await self.session.flush()
            created_new = True

        notes_created = 0
        media_created = 0
        for msg in conv_in.messages:
            note_row, n_media = await self._import_message(conv, msg)
            if note_row is not None:
                notes_created += 1
                media_created += n_media

        return created_new, notes_created, media_created

    async def _import_message(
        self,
        conv: Conversation,
        msg: ChatGPTMessage,
    ) -> Tuple[Optional[Note], int]:
        text = msg.content or ""

        # Collect images from metadata, supporting both clean-schema shapes.
        images: List[Dict[str, Any]] = []
        md = msg.metadata
        if md:
            if md.images:
                images = list(md.images)
            elif md.image_url:
                images = [{"url": md.image_url}]

        if not text.strip() and not images:
            return None, 0

        # Build the note's persisted metadata. Image refs are recorded as
        # Media rows, so we DON'T re-stuff them into notemetadata.
        notemd: Dict[str, Any] = {}
        if md:
            if md.language:
                notemd["language"] = md.language
            if md.model:
                notemd["model"] = md.model
            if md.chatgpt_request_id:
                notemd["chatgpt_request_id"] = md.chatgpt_request_id
        if msg.id:
            notemd["chatgpt_message_id"] = msg.id
        if msg.parent_id:
            notemd["chatgpt_parent_id"] = msg.parent_id

        if images:
            ct = ContentType.IMAGE
        elif msg.content_type == "code" or "```" in text:
            ct = ContentType.CODE
        else:
            ct = ContentType.TEXT

        note = Note(
            id=uuid4(),
            user_id=self.user.id,
            conversation_id=conv.id,
            content=text,
            content_type=ct,
            role=_normalize_role(msg.role),
            timestamp=_parse_iso(msg.timestamp) or _now(),
            created_at=_now(),
            updated_at=_now(),
            notemetadata=notemd,
            title="",
        )
        self.session.add(note)
        await self.session.flush()

        media_count = 0
        for pos, image in enumerate(images):
            if await self._resolve_and_save_image(image, note, pos):
                media_count += 1

        return note, media_count

    # ─── image resolution paths ──────────────────────────────────────

    async def _resolve_and_save_image(
        self,
        image: Dict[str, Any],
        note: Note,
        position_index: int,
    ) -> Optional[UUID]:
        url = (image.get("url") or image.get("image_url") or "").strip()
        if not url:
            return None

        # Path A — already in S3 (the /chatgpt/upload normalizer's output).
        if image.get("already_in_s3") and not url.startswith(("http://", "https://", "data:")):
            return await self._persist_media(
                note=note,
                s3_key=url,
                mime=image.get("mime_type") or "application/octet-stream",
                file_size=image.get("file_size") or 0,
                original_filename=image.get("original_filename") or f"image-{uuid4().hex[:8]}",
                position_index=position_index,
            )

        # Path B — data URL (future ChatGPT extension, base64 inline).
        if url.startswith("data:"):
            decoded = self._decode_data_url(url)
            if not decoded:
                return None
            binary, mime = decoded
            ext = _ext_from_mime(mime)
            s3_key = f"conversations/{note.conversation_id}/{uuid4().hex}.{ext}"
            try:
                await upload_media_bytes(binary, s3_key, mime)
            except Exception as exc:
                logger.error("S3 upload failed for note %s: %s", note.id, exc, exc_info=True)
                return None
            return await self._persist_media(
                note=note,
                s3_key=s3_key,
                mime=mime,
                file_size=len(binary),
                original_filename=image.get("original_filename") or f"image-{uuid4().hex[:8]}.{ext}",
                position_index=position_index,
            )

        # Path C — http(s) URL with allowlist + size cap.
        if url.startswith(("http://", "https://")):
            fetched = await self._fetch_url_safely(url)
            if not fetched:
                return None
            binary, mime = fetched
            ext = _ext_from_mime(mime)
            s3_key = f"conversations/{note.conversation_id}/{uuid4().hex}.{ext}"
            try:
                await upload_media_bytes(binary, s3_key, mime)
            except Exception as exc:
                logger.error("S3 upload failed for note %s: %s", note.id, exc, exc_info=True)
                return None
            return await self._persist_media(
                note=note,
                s3_key=s3_key,
                mime=mime,
                file_size=len(binary),
                original_filename=image.get("original_filename") or url.rsplit("/", 1)[-1][:100],
                position_index=position_index,
            )

        logger.warning("Unrecognised image URL on note %s: %s", note.id, url[:120])
        return None

    @staticmethod
    def _decode_data_url(url: str) -> Optional[Tuple[bytes, str]]:
        try:
            prefix, b64 = url.split(",", 1)
        except ValueError:
            return None
        mime = "application/octet-stream"
        if ":" in prefix and ";" in prefix:
            mime = prefix.split(":", 1)[1].split(";", 1)[0]
        try:
            return base64.b64decode(b64), mime
        except Exception as exc:
            logger.warning("data: URL decode failed: %s", exc)
            return None

    @staticmethod
    async def _fetch_url_safely(url: str) -> Optional[Tuple[bytes, str]]:
        try:
            host = urlparse(url).hostname or ""
        except Exception:
            return None
        if host not in _FETCH_ALLOWLIST:
            logger.warning("Refusing to fetch URL outside allowlist: %s", host)
            return None

        def _do_fetch() -> Optional[Tuple[bytes, str]]:
            req = Request(url, headers={"User-Agent": "calendar-by-kla/1.0"})
            try:
                with urlopen(req, timeout=_FETCH_TIMEOUT_SEC) as resp:
                    if getattr(resp, "status", 200) != 200:
                        return None
                    mime = (resp.headers.get("content-type") or "application/octet-stream").split(";", 1)[0].strip()
                    chunks: List[bytes] = []
                    total = 0
                    while True:
                        chunk = resp.read(64 * 1024)
                        if not chunk:
                            break
                        total += len(chunk)
                        if total > _MAX_FETCH_BYTES:
                            logger.warning("Fetch %s exceeded %d bytes; aborting", url, _MAX_FETCH_BYTES)
                            return None
                        chunks.append(chunk)
                    return b"".join(chunks), mime
            except Exception as exc:
                logger.warning("Fetch %s failed: %s", url, exc)
                return None

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _do_fetch)

    async def _persist_media(
        self,
        note: Note,
        s3_key: str,
        mime: str,
        file_size: int,
        original_filename: str,
        position_index: int,
    ) -> UUID:
        media = Media(
            id=uuid4(),
            user_id=self.user.id,
            note_id=note.id,
            file_path=s3_key,
            file_type=_media_type_from_mime(mime),
            file_size=file_size,
            mime_type=mime,
            original_filename=(original_filename or "")[:255],
            position_index=position_index,
        )
        self.session.add(media)
        await self.session.flush()
        return media.id