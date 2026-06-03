import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context
from sqlmodel import SQLModel

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models so SQLModel registers them in metadata
from Cal_Backend.db.models import (
    User, Conversation, Project, Label, Note,
    Media, ChecklistItem, NoteLabel, ImportJob
)

target_metadata = SQLModel.metadata


def get_url() -> str:
    from Cal_Backend.config import Config
    return Config.DATABASE_URL


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    from Cal_Backend.db.main import get_connect_args
    url = get_url()
    engine = create_async_engine(
        url, 
        poolclass=pool.NullPool,
        connect_args=get_connect_args(url)
    )
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
