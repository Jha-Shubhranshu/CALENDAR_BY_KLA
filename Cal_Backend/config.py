from pydantic_settings import BaseSettings, SettingsConfigDict

from pydantic import ConfigDict

#Added by claude for the implementation of the AI Chat Feature

from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL : str = "postgresql+asyncpg://postgres:Authority_admin@localhost:5432/Calendar"
    JWT_SECRET: str
    JWT_ALGORITHM: str
    redis_url: str = "redis://localhost:6379/0"

    REDIS_HOST: str ="localhost"        #Redis was used for token revoking functionality, if I recall correctly.
    REDIS_PORT: int =6379
    
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_PORT: int                      #how does this relate to this computer? How is it working as an Identifier?
    MAIL_SERVER: str
    MAIL_FROM_NAME: str
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True
        
    model_config = SettingsConfigDict(env_file=".env",extra="ignore")
    
    
    
    
    
    
    
    #Added by claude for AI Chat Feature
    PERPLEXITY_API_KEY: str
    PERPLEXITY_BASE_URL: str = "https://api.perplexity.ai"
    PERPLEXITY_MODEL: str = "sonar"
    PERPLEXITY_TIMEOUT: int = 120
    STORAGE_TYPE: str = "s3"  # 's3' or 'local'
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_S3_BUCKET: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    LOCAL_STORAGE_PATH: str = "./uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_MIME_TYPES: list = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
        'text/plain'
    ]
    MAX_CONTEXT_TOKENS: int = 120000
    MAX_MESSAGE_LENGTH: int = 50000
    MESSAGES_PER_PAGE: int = 50
    
model_config = ConfigDict(
    env_file=".env",
    case_sensitive=True
)
    
Config = Settings()


 
settings = Settings() #created by claude for AI Chat Implementation

broker_url = Config.redis_url                 # ye kiska syntax hai, kiska keyword hai ye?

result_backen = Config.redis_url