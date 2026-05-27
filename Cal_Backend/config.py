from dotenv import load_dotenv
load_dotenv()
import json
import os
import logging
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _fetch_aws_secrets() -> dict:
    """Fetch secrets from Secrets Manager. Cached across requests in the same container."""
    secret_name = os.getenv("SECRETS_NAME")
    if not secret_name:
        logger.info("SECRETS_NAME not set; running in local mode.")
        return {}

    try:
        import boto3
        region = os.getenv("AWS_REGION", "us-east-1")
        logger.info(f"Fetching secrets from {secret_name} in {region}")
        client = boto3.client("secretsmanager", region_name=region)
        response = client.get_secret_value(SecretId=secret_name)
        return json.loads(response["SecretString"])
    except Exception as e:
        logger.error(f"Error fetching secrets: {str(e)}")
        # If we are in AWS but can't fetch secrets, this is a critical failure.
        # However, we'll return empty dict and let the Settings class handle validation.
        return {}


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres@localhost:5432/Calendar"
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    redis_url: str = "redis://localhost:6379/0"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = ""
    S3_MEDIA_BUCKET_NAME: str = ""
    SQS_IMPORT_QUEUE_URL: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def model_post_init(self, __context) -> None:
        """Overlay AWS secrets on top of env-var/default values. Runs once per Settings() call."""
        secrets = _fetch_aws_secrets()

        # Prefer a full DATABASE_URL stored in Secrets Manager (optional).
        # Fallback: inject DB_PASSWORD into the password-less URL in the env var.
        # Expected env-var format: scheme://user@host:port/dbname  (no password)
        if "DATABASE_URL" in secrets and secrets["DATABASE_URL"] != "placeholder":
            logger.info("Using DATABASE_URL from Secrets Manager")
            object.__setattr__(self, "DATABASE_URL", secrets["DATABASE_URL"])
        elif "DB_PASSWORD" in secrets and secrets["DB_PASSWORD"] != "placeholder":
            logger.info("Injecting DB_PASSWORD from Secrets Manager into DATABASE_URL")
            url = self.DATABASE_URL
            db_password = secrets["DB_PASSWORD"]
            # Insert ":password" between the username and the "@host" portion
            if "://" in url and "@" in url:
                scheme_and_user, rest = url.split("@", 1)
                object.__setattr__(self, "DATABASE_URL", f"{scheme_and_user}:{db_password}@{rest}")

        if "JWT_SECRET" in secrets and secrets["JWT_SECRET"] != "placeholder":
            object.__setattr__(self, "JWT_SECRET", secrets["JWT_SECRET"])

        # Fail loudly if in AWS but JWT_SECRET still empty
        if os.getenv("SECRETS_NAME") and not self.JWT_SECRET:
            logger.error("JWT_SECRET is missing after secrets fetch!")
            # In production, this will cause a 500 error on first request, which is better than a silent fail
            # but we won't raise RuntimeError here to allow the app to at least start and log errors.


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Lazy singleton. First call triggers secrets fetch; subsequent calls return cached."""
    return Settings()


# Backward-compat module-level reference. Property-like behavior via __getattr__.
def __getattr__(name: str):
    if name == "Config":
        return get_settings()
    raise AttributeError(f"module 'config' has no attribute {name!r}")