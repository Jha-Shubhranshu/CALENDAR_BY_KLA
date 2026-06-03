import asyncio
import logging
from functools import lru_cache


import aioboto3
from datetime import datetime
from Cal_Backend.config import get_settings


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


async def upload_media_bytes(data: bytes, key: str, content_type: str) -> str:
    """
    Upload binary media (image bytes) to the media S3 bucket.
    Returns the S3 key for storage in the Media row.
    """
    settings = get_settings()
    session = aioboto3.Session()
    async with session.client("s3") as client:
        await client.put_object(
            Bucket=settings.S3_MEDIA_BUCKET_NAME,  # ← see note below
            Key=key,
            Body=data,
            ContentType=content_type,
            # The media bucket is private; CloudFront with OAC serves to users.
        )
    return key


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


async def upload_media(data: bytes, key: str, content_type: str = "image/png") -> bool:
    """Upload binary media to the dedicated media bucket"""
    from Cal_Backend.config import get_settings
    settings = get_settings()
    
    # In local mode without a bucket set, we just skip but return True to not break ingestion
    bucket = settings.S3_MEDIA_BUCKET_NAME or settings.S3_BUCKET_NAME
    if not bucket:
        logger.warning("No S3 bucket configured for media upload. Skipping.")
        return True

    def _upload():
        _get_s3_client().put_object(
            Bucket=bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )

    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, _upload)
        logger.info(f"Uploaded media to s3://{bucket}/{key}")
        return True
    except Exception as e:
        logger.error(f"S3 media upload error for key {key}: {e}")
        return False


async def delete_media(key: str) -> None:
    """Delete media from the dedicated media bucket"""
    from Cal_Backend.config import get_settings
    settings = get_settings()
    
    bucket = settings.S3_MEDIA_BUCKET_NAME or settings.S3_BUCKET_NAME
    if not bucket:
        return

    def _delete():
        _get_s3_client().delete_object(Bucket=bucket, Key=key)

    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, _delete)
    except Exception as e:
        logger.warning(f"S3 media delete error for key {key}: {e}")


async def upload_media_bytes(data: bytes, key: str, content_type: str) -> str:
    """Upload binary media to the media S3 bucket. Returns the S3 key."""
    settings = get_settings()
    session = aioboto3.Session()
    async with session.client("s3") as client:
        await client.put_object(
            Bucket=settings.S3_MEDIA_BUCKET_NAME,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
    return key


async def generate_presigned_url(key: str, expires_in: int = 900) -> str:
    """
    Generate a short-lived URL for a private media object.
    Default: 15 minutes. Used when serving images to the frontend.
    """
    settings = get_settings()
    session = aioboto3.Session()
    async with session.client("s3") as client:
        url = await client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_MEDIA_BUCKET_NAME, "Key": key},
            ExpiresIn=expires_in,
        )
    return url


# =============================================================================
# APPEND THIS TO Cal_Backend/storage/s3.py
# (same file that has upload_import_data / upload_media_bytes etc.)
# =============================================================================


async def presign_import_upload(
    key: str,
    content_type: str = "application/zip",
    expires_in: int = 900,  # 15 minutes
) -> str:
    """
    Issue a presigned PUT URL for the imports bucket. The browser uploads the
    ZIP directly to S3 with `Content-Type: application/zip`, bypassing API
    Gateway's 10 MB body cap. Same Content-Type must be sent at upload time
    or the signature won't verify.
    """
    from Cal_Backend.config import get_settings
    settings = get_settings()

    def _presign() -> str:
        return _get_s3_client().generate_presigned_url(
            "put_object",
            Params={
                "Bucket":      settings.S3_BUCKET_NAME,
                "Key":         key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
            HttpMethod="PUT",
        )

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _presign)


async def import_object_exists(key: str) -> bool:
    """Verify a presigned-uploaded object actually landed before queuing a job."""
    from Cal_Backend.config import get_settings
    settings = get_settings()

    def _head() -> bool:
        try:
            _get_s3_client().head_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
            return True
        except Exception:
            return False

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _head)