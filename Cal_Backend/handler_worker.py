"""
AWS Lambda entry point for the SQS-triggered import worker.
Deploy this as a separate Lambda function with an SQS event source mapping
pointing at the import queue. Each SQS message triggers one import job.
"""
import asyncio
import json
import logging

from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from Cal_Backend.db.main import DATABASE_URL_ASYNC, _get_connect_args

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _make_session() -> AsyncSession:
    """
    Create a brand-new engine and session for this invocation.

    NullPool ensures SQLAlchemy never reuses connections across invocations.
    Each Lambda call gets a fresh connection opened and closed within that
    call — no leftovers, no stale event loop references.
    """
    engine = create_async_engine(
        DATABASE_URL_ASYNC,
        echo=False,
        future=True,
        connect_args=_get_connect_args(DATABASE_URL_ASYNC),
        poolclass=NullPool,
    )
    Session = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    return Session()


async def _run_jobs(records: list) -> None:
    """Process all SQS records using a single fresh DB session."""
    from Cal_Backend.user_data_import.worker import process_import_job

    async with _make_session() as session:
        for record in records:
            body = json.loads(record["body"])
            job_id   = body["job_id"]
            s3_key   = body["s3_key"]
            user_id  = body["user_id"]
            job_type = body["job_type"]

            logger.info(f"Processing job {job_id} (type={job_type})")
            try:
                # NOTE: process_import_job creates its own session internally
                # (see worker.py). We don't pass `session` here — doing so
                # would raise TypeError because the function signature does
                # not accept it.
                await process_import_job(
                    job_id, user_id, job_type,
                    s3_key=s3_key,
                )
                logger.info(f"Job {job_id} finished")
            except Exception as exc:
                logger.error(f"Job {job_id} failed: {exc}", exc_info=True)
                raise  # re-raise so SQS retries the message


async def _close_redis_pool() -> None:
    """
    Release every connection in the module-scoped Redis client's pool while
    this invocation's event loop is still alive.

    The client `token_blocklist` in db/redis.py lives at module scope, so it
    survives across warm Lambda invocations. Without this cleanup, redis-py
    keeps pooled connections whose transports point at the loop we are about
    to close — and the next warm invocation crashes the first time it calls
    `set_job_status` with `RuntimeError: Event loop is closed`.

    `aclose()` closes the connections but leaves the client object reusable:
    the next invocation lazily re-opens fresh connections on the new loop.
    """
    try:
        from Cal_Backend.db.redis import token_blocklist
        await token_blocklist.aclose()
    except Exception as exc:
        logger.warning(f"Redis aclose failed: {exc}")


def handler(event, context):
    """Lambda handler — processes SQS records one at a time."""
    records = event.get("Records", [])
    logger.info(f"Received {len(records)} SQS record(s)")

    # Fresh loop every invocation. asyncio.run() would also create+close a
    # loop, but using new_event_loop() + set_event_loop() explicitly lets us
    # run our own cleanup (the Redis pool drain) on the dying loop *before*
    # we close it.
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_run_jobs(records))
    finally:
        try:
            loop.run_until_complete(_close_redis_pool())
        finally:
            loop.close()

    return {"statusCode": 200}