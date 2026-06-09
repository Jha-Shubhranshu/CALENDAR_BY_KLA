from dotenv import load_dotenv
load_dotenv()
import os
import logging
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _fetch_ssm_parameters() -> dict:
    """
    Fetch SecureString parameters from SSM Parameter Store under a path
    prefix (e.g. /calendar-by-kla/). Cached for the lifetime of the
    Lambda container — first request pays the SSM round-trip, the rest
    hit the in-memory cache.

    Parameter naming convention:
      /<project>/<KEY>  →  {"<KEY>": "<value>"}
    e.g. /calendar-by-kla/JWT_SECRET, /calendar-by-kla/DATABASE_URL
    """
    prefix = os.getenv("SSM_PREFIX")
    if not prefix:
        logger.info("SSM_PREFIX not set; running in local mode.")
        return {}

    try:
        import boto3
        region = os.getenv("AWS_REGION", "us-east-1")
        logger.info(f"Fetching SSM parameters under {prefix} in {region}")
        client = boto3.client("ssm", region_name=region)

        out: dict = {}
        paginator = client.get_paginator("get_parameters_by_path")
        for page in paginator.paginate(
            Path=prefix,
            Recursive=True,
            WithDecryption=True,
        ):
            for param in page.get("Parameters", []):
                # "/calendar-by-kla/JWT_SECRET" -> "JWT_SECRET"
                key = param["Name"].rsplit("/", 1)[-1]
                out[key] = param["Value"]
        return out
    except Exception as e:
        logger.error(f"Error fetching SSM parameters: {str(e)}")
        return {}


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres@localhost:5432/Calendar"
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = ""
    S3_MEDIA_BUCKET_NAME: str = ""
    SQS_IMPORT_QUEUE_URL: str = ""
    # Redis fields removed — Redis is no longer used in hobby mode.

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def model_post_init(self, __context) -> None:
        """Overlay SSM parameters on top of env-var/default values."""
        params = _fetch_ssm_parameters()

        # DATABASE_URL takes precedence if stored in SSM
        if "DATABASE_URL" in params and params["DATABASE_URL"] != "placeholder":
            logger.info("Using DATABASE_URL from SSM")
            object.__setattr__(self, "DATABASE_URL", params["DATABASE_URL"])

        if "JWT_SECRET" in params and params["JWT_SECRET"] != "placeholder":
            object.__setattr__(self, "JWT_SECRET", params["JWT_SECRET"])

        # Fail loud if running in AWS but JWT_SECRET still empty
        if os.getenv("SSM_PREFIX") and not self.JWT_SECRET:
            logger.error("JWT_SECRET is missing after SSM fetch!")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Lazy singleton — first call triggers SSM fetch, subsequent return cached."""
    return Settings()


def __getattr__(name: str):
    if name == "Config":
        return get_settings()
    raise AttributeError(f"module 'config' has no attribute {name!r}")