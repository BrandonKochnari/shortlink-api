"""remove email verification fields

Revision ID: 20260611_02
Revises: 20260611_01
Create Date: 2026-06-11 01:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260611_02"
down_revision = "20260611_01"
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
    with op.batch_alter_table("users") as batch_op:
        if _has_index("users", "ix_users_verification_token"):
            batch_op.drop_index("ix_users_verification_token")
        if _has_column("users", "verification_token_expires_at"):
            batch_op.drop_column("verification_token_expires_at")
        if _has_column("users", "verification_token"):
            batch_op.drop_column("verification_token")
        if _has_column("users", "email_verified"):
            batch_op.drop_column("email_verified")


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        if not _has_column("users", "email_verified"):
            batch_op.add_column(
                sa.Column(
                    "email_verified",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                )
            )
        if not _has_column("users", "verification_token"):
            batch_op.add_column(sa.Column("verification_token", sa.String(), nullable=True))
        if not _has_column("users", "verification_token_expires_at"):
            batch_op.add_column(sa.Column("verification_token_expires_at", sa.DateTime(), nullable=True))
        if not _has_index("users", "ix_users_verification_token"):
            batch_op.create_index("ix_users_verification_token", ["verification_token"], unique=True)
