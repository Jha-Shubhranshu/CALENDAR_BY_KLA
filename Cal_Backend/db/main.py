from sqlmodel import create_engine, text, SQLModel
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from Cal_Backend.config import Config
import logging

def _ensure_async_driver(url: str) -> str:
    """Ensure the SQLAlchemy URL uses an async driver."""
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("mysql://"):
        return url.replace("mysql://", "mysql+aiomysql://", 1)
    return url

DATABASE_URL_ASYNC = _ensure_async_driver(Config.DATABASE_URL)

# Create async engine properly
engine: AsyncEngine = create_async_engine(
    DATABASE_URL_ASYNC,
    echo=True,
    future=True,
)

# Silence SQLAlchemy engine INFO logs
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

async def init_db() -> None:

    print(f"Connecting to: {Config.DATABASE_URL}")  # ← add temporarily
    """Initialize database by creating all tables."""
    # Import ALL models to register them with SQLModel metadata
    from Cal_Backend.db.models import (
        User, Conversation, Project, Label, Note, 
        Media, ChecklistItem, NoteLabel
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
