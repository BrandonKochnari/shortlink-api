"""add delete cascade for clicks url foreign key

Revision ID: 20260609_02
Revises: 20260609_01
Create Date: 2026-06-09 03:40:00
"""

from alembic import op


revision = "20260609_02"
down_revision = "20260609_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    if bind.dialect.name == "sqlite":
        return

    with op.batch_alter_table("clicks") as batch_op:
        batch_op.drop_constraint("clicks_url_id_fkey", type_="foreignkey")
        batch_op.create_foreign_key(
            "clicks_url_id_fkey",
            "urls",
            ["url_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    bind = op.get_bind()

    if bind.dialect.name == "sqlite":
        return

    with op.batch_alter_table("clicks") as batch_op:
        batch_op.drop_constraint("clicks_url_id_fkey", type_="foreignkey")
        batch_op.create_foreign_key(
            "clicks_url_id_fkey",
            "urls",
            ["url_id"],
            ["id"],
        )
