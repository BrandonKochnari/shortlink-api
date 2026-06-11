"""add email verification fields

Revision ID: 20260611_01
Revises: 20260609_02
Create Date: 2026-06-11 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260611_01"
down_revision = "20260609_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "email_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column("users", sa.Column("verification_token", sa.String(), nullable=True))
    op.add_column(
        "users",
        sa.Column("verification_token_expires_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        op.f("ix_users_verification_token"),
        "users",
        ["verification_token"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_verification_token"), table_name="users")
    op.drop_column("users", "verification_token_expires_at")
    op.drop_column("users", "verification_token")
    op.drop_column("users", "email_verified")
