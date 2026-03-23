# from sqlmodel import create_engine, text, SQLModel
# from typing import AsyncGenerator
# from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine, AsyncSession
# from sqlalchemy.orm import sessionmaker
# from Cal_Backend.config import Config
# import logging

# def _ensure_async_driver(url: str) -> str:
#     """Ensure the SQLAlchemy URL uses an async driver."""
#     if url.startswith("postgresql://"):
#         return url.replace("postgresql://", "postgresql+asyncpg://", 1)
#     if url.startswith("mysql://"):
#         return url.replace("mysql://", "mysql+aiomysql://", 1)
#     return url

# DATABASE_URL_ASYNC = _ensure_async_driver(Config.DATABASE_URL)

# # Create async engine properly
# engine: AsyncEngine = create_async_engine(
#     DATABASE_URL_ASYNC,
#     echo=True,
#     future=True,
#     connect_args={"ssl": "require"}  # ← add this
# )

# # Silence SQLAlchemy engine INFO logs
# logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

# async def init_db() -> None:

#     print(f"Connecting to: {Config.DATABASE_URL}")  # ← add temporarily
#     """Initialize database by creating all tables."""
#     # Import ALL models to register them with SQLModel metadata
#     from Cal_Backend.db.models import (
#         User, Conversation, Project, Label, Note, 
#         Media, ChecklistItem, NoteLabel
#     )
    
#     async with engine.begin() as conn:
#         await conn.run_sync(SQLModel.metadata.create_all)

# async def get_session() -> AsyncGenerator[AsyncSession, None]:
#     Session = sessionmaker(
#         bind=engine,
#         class_=AsyncSession,
#         expire_on_commit=False
#     )
    
#     async with Session() as session:
#         yield session


from sqlmodel import SQLModel
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from Cal_Backend.config import Config
import logging
import os


def _ensure_async_driver(url: str) -> str:
    """Ensure the SQLAlchemy URL uses an async driver."""
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("mysql://"):
        return url.replace("mysql://", "mysql+aiomysql://", 1)
    return url


DATABASE_URL_ASYNC = _ensure_async_driver(Config.DATABASE_URL)


def _get_connect_args(url: str) -> dict:
    """
    Decide SSL config based on environment.
    """
    ENV = os.getenv("ENV", "local")  # default to local

    # Local development → NO SSL
    if ENV == "local" or "localhost" in url:
        return {"ssl": False}

    # Production (Render + Supabase) → REQUIRE SSL
    return {"ssl": "require"}


# Create async engine with dynamic SSL handling
engine: AsyncEngine = create_async_engine(
    DATABASE_URL_ASYNC,
    echo=True,
    future=True,
    connect_args=_get_connect_args(DATABASE_URL_ASYNC)
)


# Silence SQLAlchemy engine INFO logs
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


async def init_db() -> None:
    """Initialize database by creating all tables."""

    print(f"ENV: {os.getenv('ENV')}")
    print(f"Connecting to: {Config.DATABASE_URL}")

    # Import ALL models to register metadata
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