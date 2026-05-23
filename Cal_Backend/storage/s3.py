import asyncio
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_s3_client():
    import boto3
    from Cal_Backend.config import get_settings
    return boto3.client("s3", region_name=get_settings().AWS_REGION)


async def upload_import_data(data: bytes, key: str) -> bool:
    from Cal_Backend.config import get_settings
    settings = get_settings()
    if not settings.S3_BUCKET_NAME:
        return False

    def _upload():
        _get_s3_client().put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=key,
            Body=data,
            ContentType="application/json",
        )

    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, _upload)
        logger.info(f"Uploaded import payload to s3://{settings.S3_BUCKET_NAME}/{key}")
        return True
    except Exception as e:
        logger.error(f"S3 upload error for key {key}: {e}")
        return False


async def download_import_data(key: str) -> bytes:
    from Cal_Backend.config import get_settings
    settings = get_settings()

    def _download():
        response = _get_s3_client().get_object(
            Bucket=settings.S3_BUCKET_NAME, Key=key
        )
        return response["Body"].read()

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _download)


async def delete_import_data(key: str) -> None:
    from Cal_Backend.config import get_settings
    settings = get_settings()
    if not settings.S3_BUCKET_NAME:
        return

    def _delete():
        _get_s3_client().delete_object(Bucket=settings.S3_BUCKET_NAME, Key=key)

    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, _delete)
    except Exception as e:
        logger.warning(f"S3 delete error for key {key}: {e}")
