from sqlmodel import SQLModel
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from Cal_Backend.config import Config
import logging
import os


def _ensure_async_driver(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("mysql://"):
        return url.replace("mysql://", "mysql+aiomysql://", 1)
    return url


DATABASE_URL_ASYNC = _ensure_async_driver(Config.DATABASE_URL)


def _get_connect_args(url: str) -> dict:
    env = os.getenv("ENVIRONMENT", "production").lower()
    if env in ("local", "dev", "development") and "localhost" in url:
        return {"ssl": False}
    return {"ssl": "require"}


engine: AsyncEngine = create_async_engine(
    DATABASE_URL_ASYNC,
    echo=False,
    future=True,
    connect_args=_get_connect_args(DATABASE_URL_ASYNC),
    pool_size=2,
    max_overflow=0,
    pool_pre_ping=True,
    pool_recycle=300,
)

logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


async def init_db() -> None:
    from Cal_Backend.db.models import (
        User, Conversation, Project, Label, Note,
        Media, ChecklistItem, NoteLabel, ImportJob
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    Session = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    async with Session() as session:
        yield session
