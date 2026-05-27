from sqlmodel import SQLModel
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from Cal_Backend.config import Config
import logging
import os

logger = logging.getLogger(__name__)


def _ensure_async_driver(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("mysql://"):
        return url.replace("mysql://", "mysql+aiomysql://", 1)
    return url


DATABASE_URL_ASYNC = _ensure_async_driver(Config.DATABASE_URL)

import re
_masked = re.sub(r"://([^:]+):([^@]+)@", r"://\1:****@", DATABASE_URL_ASYNC)
logger.warning(f"DATABASE_URL_ASYNC in use: {_masked}")

def _get_connect_args(url: str) -> dict:
    """
    Build the kwargs that get forwarded to asyncpg's connect() call.
    Note: asyncpg uses 'timeout' (not 'connect_timeout') for connection attempts.
    """
    env = os.getenv("ENVIRONMENT", "production").lower()

    # asyncpg-level kwargs (NOT SQLAlchemy engine kwargs)
    args: dict = {
        "timeout": 10,           # seconds before giving up on a fresh DB connection
        "command_timeout": 30,   # seconds before killing a long-running query
    }

    # Local dev against localhost Postgres → no SSL
    if env in ("local", "dev", "development") and "localhost" in url:
        args["ssl"] = False
    else:
        args["ssl"] = "require"

    return args


engine: AsyncEngine = create_async_engine(
    DATABASE_URL_ASYNC,
    echo=False,
    future=True,
    connect_args=_get_connect_args(DATABASE_URL_ASYNC),
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_timeout=30,   # seconds a request will wait to borrow a connection from the pool
)

logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


async def init_db() -> None:
    from Cal_Backend.db.models import (
        User, Conversation, Project, Label, Note,
        Media, ChecklistItem, NoteLabel, ImportJob
    )
    try:
        logger.info("Initializing database tables...")
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        logger.info("Database initialization complete.")
    except Exception as e:
        logger.error(f"Error during database initialization: {str(e)}")
        raise


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    Session = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    try:
        async with Session() as session:
            yield session
    except Exception as e:
        logger.error(f"Error creating database session: {str(e)}")
        raise