import json
import asyncio
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_sqs_client():
    import boto3
    from Cal_Backend.config import get_settings
    return boto3.client("sqs", region_name=get_settings().AWS_REGION)


async def enqueue_import_job(job_id: str, s3_key: str, user_id: str, job_type: str) -> bool:
    from Cal_Backend.config import get_settings
    settings = get_settings()
    if not settings.SQS_IMPORT_QUEUE_URL:
        return False

    def _send():
        client = _get_sqs_client()
        client.send_message(
            QueueUrl=settings.SQS_IMPORT_QUEUE_URL,
            MessageBody=json.dumps({
                "job_id": job_id,
                "s3_key": s3_key,
                "user_id": user_id,
                "job_type": job_type,
            }),
        )

    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, _send)
        logger.info(f"Enqueued import job {job_id} to SQS")
        return True
    except Exception as e:
        logger.error(f"SQS enqueue error for job {job_id}: {e}")
        return False
