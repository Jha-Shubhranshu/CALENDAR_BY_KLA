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
) -> None:
    """
    Run a single import job end-to-end.

    Resolves payload (S3 or in-memory), dispatches to the correct service by
    job_type, and writes status updates at PROCESSING / COMPLETED / FAILED.
    """
    logger.info("WORKER STARTING: Job %s (%s)", job_id, job_type)

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

        elif job_type == "json":
            from Cal_Backend.user_data_import.service import (
                ImportService,
                validate_import_data,
            )

            data = validate_import_data(data)
            service = ImportService(session, user)
            result_stats = await service.import_conversations(data)

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
        # Log with full traceback so CloudWatch shows where it broke.
        logger.error(
            "WORKER CRASH on job %s: %s\n%s",
            job_id, exc, traceback.format_exc(),
        )

        # Best-effort: record FAILED state. If even this write fails (Redis
        # outage, DB rollback, etc.) we now log it instead of silently
        # swallowing — the user-facing job will be stuck, but ops will know.
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
        await session.close()