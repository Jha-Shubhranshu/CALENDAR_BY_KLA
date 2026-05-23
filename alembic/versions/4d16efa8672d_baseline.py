"""baseline

Revision ID: 4d16efa8672d
Revises: 
Create Date: 2026-05-21 20:30:13.601433
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '4d16efa8672d'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Backfill any NULL accounts before tightening to NOT NULL
    op.execute("UPDATE conversations SET account = '' WHERE account IS NULL")

    op.alter_column(
        'conversations', 'account',
        existing_type=sa.TEXT(),
        type_=sqlmodel.sql.sqltypes.AutoString(),
        nullable=False,
    )
    op.alter_column(
        'notes', 'content',
        existing_type=sa.VARCHAR(),
        nullable=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        'notes', 'content',
        existing_type=sa.VARCHAR(),
        nullable=False,
    )
    op.alter_column(
        'conversations', 'account',
        existing_type=sqlmodel.sql.sqltypes.AutoString(),
        type_=sa.TEXT(),
        nullable=True,
    )