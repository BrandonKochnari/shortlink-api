"""initial schema

Revision ID: 20260609_01
Revises:
Create Date: 2026-06-09 03:15:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260609_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "urls",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("original_url", sa.String(), nullable=False),
        sa.Column("short_code", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_urls_id"), "urls", ["id"], unique=False)
    op.create_index(op.f("ix_urls_short_code"), "urls", ["short_code"], unique=True)

    op.create_table(
        "clicks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("url_id", sa.Integer(), nullable=False),
        sa.Column("clicked_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["url_id"], ["urls.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_clicks_id"), "clicks", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_clicks_id"), table_name="clicks")
    op.drop_table("clicks")

    op.drop_index(op.f("ix_urls_short_code"), table_name="urls")
    op.drop_index(op.f("ix_urls_id"), table_name="urls")
    op.drop_table("urls")

    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
