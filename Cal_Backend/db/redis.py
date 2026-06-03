# Redis for token revoking functionality with support for different token types
import json
import logging

import redis.asyncio as redis

from Cal_Backend.config import Config

logger = logging.getLogger(__name__)

# TTL Constants
ACCESS_TOKEN_EXPIRY  = 30 * 24 * 3600 # 30 days
REFRESH_TOKEN_EXPIRY = 30 * 24 * 3600 # 30 days
IMPORT_JOB_TTL       = 24 * 3600     # 24 hours

# Legacy constant for backward compatibility
JTI_EXPIRY = ACCESS_TOKEN_EXPIRY

# Module-scoped client. redis-py opens connections lazily on first await.
#
# IMPORTANT for the SQS worker Lambda: this object survives across warm
# invocations, so the pool MUST be drained inside each invocation's event
# loop before that loop is closed. See handler_worker._close_redis_pool.
# Without that, the next invocation crashes with "Event loop is closed".
# token_blocklist = redis.Redis(
#     host=Config.REDIS_HOST,
#     port=Config.REDIS_PORT,
#     password=Config.REDIS_PASSWORD,
#     db=0,
# )

_redis_client: redis.Redis | None = None
_redis_loop_id: int | None = None


def _get_redis() -> redis.Redis:
    """
    Return a Redis client bound to the **current** event loop.
    If the loop changed (warm Lambda reuse), tear down the stale
    client and build a fresh one so we never hit
    'Event loop is closed'.
    """
    global _redis_client, _redis_loop_id
    import asyncio

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    current_id = id(loop) if loop else None

    if _redis_client is not None and current_id == _redis_loop_id:
        return _redis_client

    # Stale client from a previous invocation's loop — discard it.
    if _redis_client is not None:
        try:
            _redis_client.connection_pool.disconnect()
        except Exception:
            pass

    _redis_client = redis.Redis(
        host=Config.REDIS_HOST,
        port=Config.REDIS_PORT,
        password=Config.REDIS_PASSWORD,
        db=0,
    )
    _redis_loop_id = current_id
    return _redis_client



async def add_jti_to_blocklist(jti: str, is_refresh: bool = False) -> None:
    """
    Add JWT ID to blocklist with appropriate TTL.

    Args:
        jti: JWT ID to blacklist
        is_refresh: True for refresh tokens, False for access tokens
    """
    try:
        expiry_time = REFRESH_TOKEN_EXPIRY if is_refresh else ACCESS_TOKEN_EXPIRY
        await _get_redis().set(name=jti, value="", ex=expiry_time)
    except Exception as e:
        # Log but don't crash the request — auth still works, the token just
        # won't be revoked. CloudWatch metric filter on "Redis error" should
        # alarm if this becomes frequent.
        logger.error("Redis error in add_jti_to_blocklist: %s", e, exc_info=True)


async def add_access_jti_to_blocklist(jti: str) -> None:
    """Convenience wrapper for access tokens."""
    await add_jti_to_blocklist(jti, is_refresh=False)


async def add_refresh_jti_to_blocklist(jti: str) -> None:
    """Convenience wrapper for refresh tokens."""
    await add_jti_to_blocklist(jti, is_refresh=True)


async def token_in_blocklist(jti: str) -> bool:
    """
    Check if a JWT ID is in the blocklist.

    Fails OPEN (returns False, allowing the token) if Redis is unreachable —
    the alternative is taking the whole API down because we can't check
    revocation. The error is logged so monitoring can catch a Redis outage.
    """
    try:
        result = await _get_redis().get(jti)
        return result is not None
    except Exception as e:
        logger.error("Redis error in token_in_blocklist: %s", e, exc_info=True)
        return False


async def get_blocklist_stats() -> dict:
    """Stats endpoint helper — used for monitoring dashboards."""
    try:
        info = await _get_redis().info()
        key_count = await _get_redis().dbsize()
        return {
            "total_keys": key_count,
            "used_memory": info.get("used_memory_human", "N/A"),
            "connected_clients": info.get("connected_clients", 0),
        }
    except Exception as e:
        logger.error("Redis error in get_blocklist_stats: %s", e, exc_info=True)
        return {"error": "Could not retrieve stats"}


async def set_job_status(job_id: str, status_data: dict) -> None:
    """
    Write a job-status snapshot for the import pipeline.

    Logs at ERROR with exc_info so the worker Lambda's log group can drive a
    CloudWatch metric filter / alarm. Silent failures here mean users see a
    stuck "processing" job until the 24 h TTL expires.
    """
    try:
        await _get_redis().set(
            f"import_job:{job_id}",
            json.dumps(status_data),
            ex=IMPORT_JOB_TTL,
        )
    except Exception as e:
        logger.error(
            "Redis error in set_job_status (job_id=%s): %s",
            job_id, e, exc_info=True,
        )


async def get_job_status(job_id: str) -> dict | None:
    """Read the current status snapshot for a job, or None if missing."""
    try:
        result = await _get_redis().get(f"import_job:{job_id}")
        if result:
            return json.loads(result)
        return None
    except Exception as e:
        logger.error(
            "Redis error in get_job_status (job_id=%s): %s",
            job_id, e, exc_info=True,
        )
        return None


async def clear_expired_tokens() -> int:
    """
    Manually clear tokens with no TTL set.

    Redis handles expiry automatically in normal operation — this only catches
    keys that were somehow written without an `ex=` argument, as a safety net
    for cleanup scripts.

    Returns:
        Number of keys cleared.
    """
    try:
        keys = await _get_redis().keys("*")
        cleared = 0
        for key in keys:
            ttl = await _get_redis().ttl(key)
            if ttl == -1:
                await _get_redis().delete(key)
                cleared += 1
        return cleared
    except Exception as e:
        logger.error("Redis error in clear_expired_tokens: %s", e, exc_info=True)
        return 0