"""
Background worker for import jobs.
Called from two places:
  - handler_worker.py        (SQS-triggered Lambda, production)
  - FastAPI BackgroundTasks  (local dev, when SQS is not configured)
Both paths converge at process_import_job().
"""
import json
import logging
import traceback
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import select
from Cal_Backend.db.models import ImportJob, ImportJobStatus, User
from Cal_Backend.db.redis import set_job_status

logger = logging.getLogger(__name__)


async def _make_session() -> AsyncSession:
    """Create a session from the global engine (used by the dev BackgroundTasks path)."""
    from Cal_Backend.db.main import engine
    Session = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    return Session()


async def _write_status(
    session: AsyncSession,
    job_id: str,
    status: ImportJobStatus,
    processed: int = 0,
    total: int = 0,
    result_stats: Optional[dict] = None,
    error: Optional[str] = None,
) -> None:
    """Persist job state to both Postgres (durable) and Redis (fast read-side)."""
    result = await session.execute(
        select(ImportJob).where(ImportJob.id == UUID(job_id))
    )
    job = result.scalar_one_or_none()
    if job:
        job.status = status
        job.processed_items = processed
        if result_stats is not None:
            job.result_stats = result_stats
        if error is not None:
            job.error_message = error
        job.updated_at = datetime.now(timezone.utc)
        session.add(job)
        await session.commit()
    redis_payload: dict = {
        "job_id": job_id,
        "status": status.value,
        "total_items": total,
        "processed_items": processed,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if result_stats:
        redis_payload["result_stats"] = result_stats
    if error:
        redis_payload["error"] = error
    await set_job_status(job_id, redis_payload)


async def process_import_job(
    job_id: str,
    user_id: str,
    job_type: str,
    s3_key: Optional[str] = None,
    in_memory_data: Optional[Any] = None,
    session: Optional[AsyncSession] = None,  # ← NEW: injected by handler_worker
) -> None:
    """
    Run a single import job end-to-end.
    Resolves payload (S3 or in-memory), dispatches to the correct service by
    job_type, and writes status updates at PROCESSING / COMPLETED / FAILED.

    session: if provided (Lambda/SQS path), use it directly — it was created
             with NullPool so it's safe across Lambda container reuse.
             If None (local dev BackgroundTasks path), create one from the
             global engine as before.
    """
    logger.info("WORKER STARTING: Job %s (%s)", job_id, job_type)

    # Determine whether we own the session (and must close it) or it was
    # injected by the caller (who will close it themselves).
    _owns_session = session is None
    if _owns_session:
        session = await _make_session()

    try:
        # ─── Load user ───────────────────────────────────────────────────
        result = await session.execute(
            select(User).where(User.id == UUID(user_id))
        )
        user = result.scalar_one_or_none()
        if not user:
            logger.error("WORKER ERROR: User %s not found", user_id)
            raise ValueError(f"User {user_id} not found")

        # ─── Load job header (for total_items) ───────────────────────────
        job_result = await session.execute(
            select(ImportJob).where(ImportJob.id == UUID(job_id))
        )
        job = job_result.scalar_one_or_none()
        total = job.total_items if job else 0

        await _write_status(
            session, job_id, ImportJobStatus.PROCESSING, 0, total,
        )

        # ─── Resolve data ────────────────────────────────────────────────
        if in_memory_data is not None:
            data = in_memory_data
        else:
            logger.info("WORKER: Downloading data from S3 %s", s3_key)
            from Cal_Backend.storage.s3 import download_import_data
            raw = await download_import_data(s3_key)
            payload = json.loads(raw)
            data = payload["data"]

        logger.info("WORKER: Processing %d items", len(data))

        # ─── Dispatch by job type ────────────────────────────────────────
        if job_type in ("google_keep", "google_keep_bulk"):
            from Cal_Backend.user_data_import.keep_service import (
                GoogleKeepImportService,
            )
            from Cal_Backend.user_data_import.notesimportschemas import (
                GoogleKeepNote,
            )
            keep_notes = [GoogleKeepNote(**n) for n in data]
            service = GoogleKeepImportService(session, user)
            stats = await service.import_notes(keep_notes)
            await session.commit()
            result_stats = {
                "notes_created":           stats.notes_created,
                "notes_skipped":           stats.notes_skipped,
                "labels_created":          stats.labels_created,
                "labels_linked":           stats.labels_linked,
                "media_created":           stats.media_created,
                "checklist_items_created": stats.checklist_items_created,
                "errors":                  stats.errors,
            }

        elif job_type == "extension_ingest":
            from Cal_Backend.user_data_import.schemas import (
                ClaudeNativeConversation,
            )
            from Cal_Backend.user_data_import.extension_service import (
                ClaudeExtensionImportService,
            )
            conversations = [ClaudeNativeConversation(**c) for c in data]
            service = ClaudeExtensionImportService(session, user)
            result_stats = await service.import_conversations(conversations)

        elif job_type == "chatgpt_ingest":
            from Cal_Backend.user_data_import.schemas import (
                ChatGPTConversation,
            )
            from Cal_Backend.user_data_import.chatgpt_service import (
                ChatGPTImportService,
            )
            conversations = [ChatGPTConversation(**c) for c in data]
            service = ChatGPTImportService(session, user)
            result_stats = await service.import_conversations(conversations)


        elif job_type == "json":
            from Cal_Backend.user_data_import.service import (
                ImportService,
                validate_import_data,
            )
            # data = validate_import_data(data)
            service = ImportService(session, user)
            result_stats = await service.import_conversations(data)

        elif job_type == "claude_json_normalize":
            # data == [{"s3_key": "claude-uploads/<user>/<uuid>.json"}]
            # Large Claude exports come through here to bypass the 10 MB
            # API-Gateway body cap. The browser PUTs the JSON to S3 directly,
            # we download it here and run the same import service as
            # extension_ingest.
            from Cal_Backend.storage.s3 import download_import_data
            from Cal_Backend.user_data_import.schemas import (
                ClaudeNativeConversation,
            )
            from Cal_Backend.user_data_import.extension_service import (
                ClaudeExtensionImportService,
            )
 
            s3_key = (data[0] if data else {}).get("s3_key")
            if not s3_key:
                raise ValueError("claude_json_normalize job missing s3_key")
 
            logger.info("WORKER: downloading Claude JSON from S3 key=%s", s3_key)
            raw_bytes = await download_import_data(s3_key)
            if not raw_bytes:
                raise ValueError(f"S3 object at {s3_key} was empty")
            logger.info(
                "WORKER: downloaded %.1f MB Claude JSON",
                len(raw_bytes) / 1024 / 1024,
            )
 
            try:
                raw_list = json.loads(raw_bytes)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Claude JSON parse failed: {exc}") from exc
 
            if not isinstance(raw_list, list):
                raise ValueError(
                    f"Claude JSON must be a top-level array, got {type(raw_list).__name__}"
                )
 
            conversations = [ClaudeNativeConversation(**c) for c in raw_list]
 
            # Account override travels on the wrapper dict alongside s3_key.
            # Direct path (/extension/ingest) does this injection inside
            # _dispatch_import before the data hits S3; the S3-loaded path
            # has to do it here, after the conversations are deserialised.
            account_override = (data[0] if data else {}).get("account")
            if account_override:
                from Cal_Backend.user_data_import.schemas import ClaudeAccountRef
                for c in conversations:
                    c.account = ClaudeAccountRef(email_address=account_override)
 
            service = ClaudeExtensionImportService(session, user)
            result_stats = await service.import_conversations(conversations)
            result_stats["json_s3_key"] = s3_key

            # Worker's total/processed will read len(data) which is 1 — patch
            # the visible numbers so the UI shows the real conversation count.
            result_stats["total_conversations"] = len(conversations)

        elif job_type == "chatgpt_zip_normalize":
            # data == [{"s3_key": "chatgpt-uploads/<user>/<uuid>.zip"}]
            from Cal_Backend.user_data_import.chatgpt_normalizer import (
                normalize_chatgpt_export_from_s3,
            )
            from Cal_Backend.user_data_import.chatgpt_service import (
                ChatGPTImportService,
            )
 
            s3_key = (data[0] if data else {}).get("s3_key")
            if not s3_key:
                raise ValueError("chatgpt_zip_normalize job missing s3_key")
 
            conversations = await normalize_chatgpt_export_from_s3(s3_key)
 
            # Same pattern as claude_json_normalize: account rode along on
            # the wrapper dict and needs to be applied after S3 unpacking.
            # ChatGPTConversation.account is a plain string field.
            account_override = (data[0] if data else {}).get("account")
            if account_override:
                for c in conversations:
                    c.account = account_override
 
            service = ChatGPTImportService(session, user)
            result_stats = await service.import_conversations(conversations)
            # total_items / processed_items get reported from result_stats
            result_stats["zip_s3_key"] = s3_key


        else:
            raise ValueError(f"Unknown job_type: {job_type}")

        # ─── Success ─────────────────────────────────────────────────────
        await _write_status(
            session,
            job_id,
            ImportJobStatus.COMPLETED,
            processed=len(data),
            total=len(data),
            result_stats=result_stats,
        )
        logger.info(
            "WORKER SUCCESS: Job %s completed. Stats: %s",
            job_id, result_stats,
        )

    except Exception as exc:
        logger.error(
            "WORKER CRASH on job %s: %s\n%s",
            job_id, exc, traceback.format_exc(),
        )
        try:
            await _write_status(
                session, job_id, ImportJobStatus.FAILED, error=str(exc),
            )
        except Exception as write_exc:
            logger.error(
                "Failed to record FAILED status for job %s: %s",
                job_id, write_exc, exc_info=True,
            )

    finally:
        # Only close the session if we created it — if it was injected by
        # handler_worker.py, the caller's `async with` block closes it.
        if _owns_session:
            await session.close()