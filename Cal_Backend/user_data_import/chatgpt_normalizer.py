"""
Normalize raw ChatGPT / OpenAI exports into the clean ChatGPTConversation
schema. Side effect: uploads referenced sidecar images to the media S3 bucket
along the way so metadata.images carries S3 keys ready for the import service.

Two entry points:
  - normalize_chatgpt_export(zip_bytes)            ← in-memory (small uploads)
  - normalize_chatgpt_export_from_s3(s3_key)       ← streamed (large uploads)
"""
import io
import json
import logging
import re
import zipfile
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from Cal_Backend.storage.s3 import download_import_data, upload_media_bytes
from .schemas import (
    ChatGPTConversation,
    ChatGPTMessage,
    ChatGPTMessageMetadata,
)

logger = logging.getLogger(__name__)


# ─────────────────────────── constants ───────────────────────────

_MIME_BY_EXT = {
    "png":  "image/png",
    "jpg":  "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif":  "image/gif",
    "bmp":  "image/bmp",
    "svg":  "image/svg+xml",
}

_EXT_BY_MIME = {v: k for k, v in _MIME_BY_EXT.items()}


# ─────────────────────────── small helpers ───────────────────────────

def _ext_from_filename(name: str) -> str:
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def _mime_from_filename(name: str) -> str:
    return _MIME_BY_EXT.get(_ext_from_filename(name), "application/octet-stream")


def _is_image_filename(name: str) -> bool:
    return _ext_from_filename(name) in _MIME_BY_EXT


def _ts_to_iso(ts: Any) -> Optional[str]:
    if ts is None:
        return None
    try:
        return datetime.fromtimestamp(float(ts), tz=timezone.utc).isoformat()
    except Exception:
        return None


def _extract_file_id(asset_pointer: str) -> Optional[str]:
    """
    Canonicalize an asset_pointer to a bare 'file-XXXX' or 'file_XXXX' id.

    Handles both schemes seen in the wild:
      - file-service://file-JUDxLe38YgyhVSFGVNVp7T  (older exports)
      - sediment://file_00000000e27c7209bc9590928def31ab  (newer)
    """
    if not asset_pointer:
        return None
    s = asset_pointer
    if "://" in s:
        s = s.split("://", 1)[1]
    s = s.strip("/")
    if s.startswith(("file-", "file_")):
        return s
    return None


def _id_match_variants(file_id: str) -> List[str]:
    """
    Generate the filename prefixes we'll try when matching sidecar files.
    ChatGPT exports have historically used both `file-XXX` and `file_XXX`
    conventions for sidecar names; produce both forms so we match either.
    """
    out = {file_id}
    if file_id.startswith("file-"):
        out.add("file_" + file_id[len("file-"):])
    elif file_id.startswith("file_"):
        out.add("file-" + file_id[len("file_"):])
    return list(out)


def _pick_current_node(mapping: Dict[str, Any], hint: Optional[str]) -> Optional[str]:
    if hint and hint in mapping:
        return hint
    leaves = [
        nid for nid, n in mapping.items()
        if n.get("message") and not n.get("children")
    ]
    if not leaves:
        return None

    def _t(nid: str) -> float:
        m = mapping.get(nid, {}).get("message") or {}
        return float(m.get("create_time") or 0)

    leaves.sort(key=_t, reverse=True)
    return leaves[0]


def _build_attachment_index(msg: dict) -> Dict[str, dict]:
    """Return {file_id: attachment_metadata_dict} for one raw message."""
    out: Dict[str, dict] = {}
    raw_md = msg.get("metadata") or {}
    for att in raw_md.get("attachments") or []:
        aid = att.get("id")
        if aid:
            out[aid] = att
    return out


# ─────────────────────────── public API ───────────────────────────

async def normalize_chatgpt_export(zip_bytes: bytes) -> List[ChatGPTConversation]:
    """In-memory entry point. Use this for small (<5MB) uploads only."""
    if not zip_bytes:
        raise ValueError("Empty ZIP payload")
    return await _normalize_zip_file(io.BytesIO(zip_bytes))


async def normalize_chatgpt_export_from_s3(s3_key: str) -> List[ChatGPTConversation]:
    """
    Stream-friendly entry point used by the worker after the browser
    has uploaded the ZIP directly to S3 via a presigned URL. Pulls
    the full ZIP into a BytesIO (Lambda RAM is fine at 3008 MB for
    typical 100–300 MB exports).
    """
    logger.info("ChatGPT normalize: downloading ZIP from s3://.../%s", s3_key)
    raw = await download_import_data(s3_key)
    if not raw:
        raise ValueError(f"ZIP at {s3_key} was empty or missing")
    logger.info("ChatGPT normalize: downloaded %.1f MB", len(raw) / 1024 / 1024)
    return await _normalize_zip_file(io.BytesIO(raw))


# ─────────────────────────── inner pipeline ───────────────────────────

async def _normalize_zip_file(zip_io: io.BytesIO) -> List[ChatGPTConversation]:
    conversations_json_path: Optional[str] = None
    sidecars: Dict[str, bytes] = {}

    with zipfile.ZipFile(zip_io) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = info.filename
            base = name.rsplit("/", 1)[-1]
            if base == "conversations.json":
                conversations_json_path = name
            elif base.startswith(("file-", "file_")):
                # Keep image-y files even when there's no extension — some
                # newer ChatGPT exports omit it.
                sidecars[base] = zf.read(info)

        if not conversations_json_path:
            raise ValueError("conversations.json not found in ZIP")

        raw_data = json.loads(zf.read(conversations_json_path).decode("utf-8"))

    if isinstance(raw_data, dict):
        raw_conversations = [raw_data]
    elif isinstance(raw_data, list):
        raw_conversations = raw_data
    else:
        raise ValueError(f"Unexpected conversations.json structure: {type(raw_data)}")

    logger.info(
        "ChatGPT normalize: %d conversations, %d sidecar files in ZIP",
        len(raw_conversations), len(sidecars),
    )

    out: List[ChatGPTConversation] = []
    for raw in raw_conversations:
        try:
            conv = await _normalize_one(raw, sidecars)
            if conv.messages:
                out.append(conv)
        except Exception as exc:
            cid = raw.get("conversation_id") or raw.get("id") or "?"
            logger.error(
                "Failed to normalize conversation %s: %s", cid, exc, exc_info=True,
            )
    return out


async def _normalize_one(
    raw: dict,
    sidecars: Dict[str, bytes],
) -> ChatGPTConversation:
    mapping = raw.get("mapping") or {}
    conv_id = raw.get("conversation_id") or raw.get("id") or str(uuid4())
    title = raw.get("title") or "Untitled ChatGPT Conversation"

    start = _pick_current_node(mapping, raw.get("current_node"))

    # TODO(lossless-import): walk every branch, not just the active one.
    # Today we follow only current_node → root, so any messages that were
    # "edited away" (regenerated, branch-abandoned) never make it into the
    # DB. To preserve them we'd need to either (a) emit multiple linear
    # views per conversation, or (b) extend the Note model with a sibling
    # pointer / branch index so the UI can render a tree later.
    chain: List[str] = []
    seen = set()
    nid = start
    while nid and nid not in seen:
        seen.add(nid)
        chain.append(nid)
        nid = mapping.get(nid, {}).get("parent")
    chain.reverse()

    messages: List[ChatGPTMessage] = []
    for cid in chain:
        node = mapping.get(cid) or {}
        msg = node.get("message")
        if not msg:
            continue

        author = msg.get("author") or {}
        role = (author.get("role") or "").lower()
        raw_md = msg.get("metadata") or {}

        # Newer exports set this flag on system scaffolding messages — much
        # more reliable than my old "system + empty" heuristic.
        if raw_md.get("is_visually_hidden_from_conversation"):
            continue

        # TODO(lossless-import): preserve tool messages (code interpreter,
        # web search, image generation) instead of dropping them.
        if role == "tool":
            continue
        # TODO(lossless-import): preserve non-empty system messages that
        # weren't already filtered above (custom instructions worth keeping).
        if role == "system":
            parts_check = (msg.get("content") or {}).get("parts") or []
            if not any((p if isinstance(p, str) else "").strip() for p in parts_check):
                continue

        # Some content_types we don't surface — they're internal context.
        content_obj = msg.get("content") or {}
        ctype_raw = content_obj.get("content_type")
        if ctype_raw in {"model_editable_context", "system_error", "user_editable_context"}:
            continue

        attachments_by_id = _build_attachment_index(msg)

        text_chunks: List[str] = []
        images_meta: List[Dict[str, Any]] = []

        for part in content_obj.get("parts") or []:
            if isinstance(part, str):
                if part and part.strip():
                    text_chunks.append(part)
            elif isinstance(part, dict):
                if part.get("content_type") == "image_asset_pointer":
                    image = await _upload_image_part(
                        part, sidecars, conv_id, attachments_by_id,
                    )
                    if image:
                        images_meta.append(image)

        text = "\n".join(text_chunks).strip()
        if not text and not images_meta:
            continue

        md_dict: Dict[str, Any] = {}
        if "```" in text:
            m = re.search(r"```(\w+)", text)
            if m:
                md_dict["language"] = m.group(1)
        if images_meta:
            md_dict["images"] = images_meta
            md_dict["image_url"] = images_meta[0]["url"]
        if raw_md.get("model_slug") or raw_md.get("resolved_model_slug"):
            md_dict["model"] = raw_md.get("resolved_model_slug") or raw_md.get("model_slug")
        if raw_md.get("request_id"):
            md_dict["chatgpt_request_id"] = raw_md["request_id"]

        if images_meta:
            ct = "image"
        elif "```" in text:
            ct = "code"
        else:
            ct = "text"

        messages.append(ChatGPTMessage(
            id=msg.get("id") or cid,
            role=role or "user",
            content=text,
            content_type=ct,
            timestamp=_ts_to_iso(msg.get("create_time")),
            parent_id=node.get("parent"),
            metadata=ChatGPTMessageMetadata(**md_dict),
        ))

    return ChatGPTConversation(
        id=conv_id,
        title=title,
        source="chatgpt",
        account="",
        created_at=_ts_to_iso(raw.get("create_time")),
        updated_at=_ts_to_iso(raw.get("update_time")),
        messages=messages,
    )


async def _upload_image_part(
    part: dict,
    sidecars: Dict[str, bytes],
    conv_id: str,
    attachments_by_id: Dict[str, dict],
) -> Optional[Dict[str, Any]]:
    """
    Resolve one image_asset_pointer to a uploaded-to-S3 image_meta dict.

    Pulls the original filename / mime / size from `metadata.attachments`
    when available (much more accurate than guessing from the sidecar
    filename, especially for newer exports).
    """
    asset_pointer = part.get("asset_pointer", "")
    file_id = _extract_file_id(asset_pointer)
    if not file_id:
        logger.warning("Unparseable asset_pointer: %r", asset_pointer)
        return None

    # Best info: the matching entry in metadata.attachments
    att = attachments_by_id.get(file_id)
    declared_filename: Optional[str] = (att or {}).get("name") if att else None
    declared_mime: Optional[str] = (att or {}).get("mime_type") if att else None
    declared_size: Optional[int] = (att or {}).get("size") if att else None

    # Find a sidecar by trying both id naming conventions.
    sidecar_name: Optional[str] = None
    sidecar_bytes: Optional[bytes] = None
    candidate_prefixes = _id_match_variants(file_id)
    for name, data in sidecars.items():
        if any(name.startswith(p) for p in candidate_prefixes):
            sidecar_name = name
            sidecar_bytes = data
            break

    if sidecar_name is None or sidecar_bytes is None:
        logger.warning("No sidecar matched for asset pointer file id: %s", file_id)
        return None

    # Mime resolution priority: declared > extension > guess
    mime = declared_mime or _mime_from_filename(sidecar_name)
    if mime == "application/octet-stream":
        mime = _mime_from_filename(declared_filename or "")
    ext = _EXT_BY_MIME.get(mime) or _ext_from_filename(sidecar_name) or "bin"
    s3_key = f"conversations/chatgpt/{conv_id}/{file_id}.{ext}"

    try:
        await upload_media_bytes(sidecar_bytes, s3_key, mime)
    except Exception as exc:
        logger.error("S3 upload failed for %s: %s", s3_key, exc, exc_info=True)
        return None

    return {
        "url":               s3_key,
        "mime_type":         mime,
        "file_size":         declared_size or len(sidecar_bytes),
        "original_filename": declared_filename or sidecar_name,
        "already_in_s3":     True,
    }