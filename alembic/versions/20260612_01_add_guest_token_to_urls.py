"""add guest token to urls

Revision ID: 20260612_01
Revises: 20260611_02
Create Date: 2026-06-12 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260612_01"
down_revision = "20260611_02"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    with op.batch_alter_table("urls") as batch_op:
        if not _has_column("urls", "guest_token"):
            batch_op.add_column(sa.Column("guest_token", sa.String(), nullable=True))
        if not _has_index("urls", "ix_urls_guest_token"):
            batch_op.create_index("ix_urls_guest_token", ["guest_token"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("urls") as batch_op:
        if _has_index("urls", "ix_urls_guest_token"):
            batch_op.drop_index("ix_urls_guest_token")
        if _has_column("urls", "guest_token"):
            batch_op.drop_column("guest_token")
