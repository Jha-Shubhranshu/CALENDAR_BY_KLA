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

    We use NullPool so SQLAlchemy never tries to reuse or ping connections
    across invocations. Each Lambda call gets a fresh connection that is
    opened and closed within that call — no leftovers, no stale event loop
    references.
    """
    engine = create_async_engine(
        DATABASE_URL_ASYNC,
        echo=False,
        future=True,
        connect_args=_get_connect_args(DATABASE_URL_ASYNC),
        poolclass=NullPool,  # ← no pool — fresh connection every time
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
                await process_import_job(
                    job_id, user_id, job_type,
                    s3_key=s3_key,
                    session=session,
                )
                logger.info(f"Job {job_id} finished")
            except Exception as exc:
                logger.error(f"Job {job_id} failed: {exc}", exc_info=True)
                raise  # Re-raise so SQS retries the message


def handler(event, context):
    """Lambda handler — processes SQS records one at a time."""
    records = event.get("Records", [])
    logger.info(f"Received {len(records)} SQS record(s)")

    # Create a completely fresh event loop every invocation.
    # asyncio.run() closes the loop when done — on a warm Lambda container
    # reuse that closed loop causes "Event loop is closed" crashes.
    # new_event_loop() + set_event_loop() guarantees we always start clean.
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_run_jobs(records))
    finally:
        loop.close()

    return {"statusCode": 200}