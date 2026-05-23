"""
AWS Lambda entry point for the SQS-triggered import worker.

Deploy this as a separate Lambda function with an SQS event source mapping
pointing at the import queue. Each SQS message triggers one import job.
"""
import asyncio
import json
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def handler(event, context):
    """Lambda handler — processes SQS records one at a time."""
    records = event.get("Records", [])
    logger.info(f"Received {len(records)} SQS record(s)")

    from Cal_Backend.user_data_import.worker import process_import_job

    for record in records:
        body = json.loads(record["body"])
        job_id = body["job_id"]
        s3_key = body["s3_key"]
        user_id = body["user_id"]
        job_type = body["job_type"]

        logger.info(f"Processing job {job_id} (type={job_type})")
        try:
            asyncio.run(
                process_import_job(job_id, user_id, job_type, s3_key=s3_key)
            )
            logger.info(f"Job {job_id} finished")
        except Exception as exc:
            logger.error(f"Job {job_id} failed: {exc}", exc_info=True)
            raise  # Re-raise so SQS retries the message

    return {"statusCode": 200}
