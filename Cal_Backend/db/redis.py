"""
Hobby-mode shim that replaces Redis with a no-op blocklist and a
Postgres-backed job status read.

Why this exists:
  - JWT blocklist: for a single-user app, immediate revocation has limited
    value (you control the only account). If a token ever leaks, rotate
    JWT_SECRET in SSM and every outstanding token dies in one shot.
    `token_in_blocklist` always returns False; revoked tokens stay valid
    until natural JWT expiry (currently 30 days — consider shortening
    access tokens if that worries you).
  - Job status: `ImportJob` rows in Postgres already carry the same data
    the Redis snapshot did. `get_job_status` now reads from there.
  - All other modules keep importing from this file unchanged. This is
    a drop-in replacement.
"""
import logging
from typing import Optional
from uuid import UUID

logger = logging.getLogger(__name__)

# Kept for backward compat with anything that imports these constants.
ACCESS_TOKEN_EXPIRY  = 30 * 24 * 3600
REFRESH_TOKEN_EXPIRY = 30 * 24 * 3600
IMPORT_JOB_TTL       = 24 * 3600
JTI_EXPIRY           = ACCESS_TOKEN_EXPIRY


# ─────────────────────── JWT blocklist (no-op) ───────────────────────

async def add_jti_to_blocklist(jti: str, is_refresh: bool = False) -> None:
    """No-op. See module docstring for rationale."""
    logger.debug("Blocklist disabled; ignoring jti=%s (refresh=%s)", jti, is_refresh)


async def add_access_jti_to_blocklist(jti: str) -> None:
    await add_jti_to_blocklist(jti, is_refresh=False)


async def add_refresh_jti_to_blocklist(jti: str) -> None:
    await add_jti_to_blocklist(jti, is_refresh=True)


async def token_in_blocklist(jti: str) -> bool:
    """Always False — no blocklist consulted."""
    return False


async def get_blocklist_stats() -> dict:
    return {
        "total_keys":        0,
        "used_memory":       "0",
        "connected_clients": 0,
        "mode":              "disabled (hobby)",
    }


async def clear_expired_tokens() -> int:
    """No-op — nothing to clear."""
    return 0


# ─────────────────────── Job status (Postgres-backed) ───────────────────────

async def set_job_status(job_id: str, status_data: dict) -> None:
    """
    No-op. The durable copy is already written by worker._write_status()
    into the ImportJob table. This Redis snapshot was only a fast read
    cache that no longer exists.
    """
    logger.debug("set_job_status no-op for job %s", job_id)


async def get_job_status(job_id: str) -> Optional[dict]:
    """
    Read the current job status from Postgres ImportJob.
    Returns the same dict shape that the old Redis-backed version did,
    so existing callers don't need to change.
    """
    # Imported inside the function to avoid a circular import at module load.
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlmodel import select
    from Cal_Backend.db.main import engine
    from Cal_Backend.db.models import ImportJob

    Session = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with Session() as session:
            result = await session.execute(
                select(ImportJob).where(ImportJob.id == UUID(job_id))
            )
            job = result.scalar_one_or_none()
            if not job:
                return None

            payload: dict = {
                "job_id":          str(job.id),
                "status":          job.status.value if hasattr(job.status, "value") else str(job.status),
                "total_items":     job.total_items,
                "processed_items": job.processed_items,
                "updated_at":      job.updated_at.isoformat() if job.updated_at else None,
            }
            if job.result_stats:
                payload["result_stats"] = job.result_stats
            if job.error_message:
                payload["error"] = job.error_message
            return payload
    except Exception as e:
        logger.error("Error reading job status from Postgres (job_id=%s): %s", job_id, e, exc_info=True)
        return None