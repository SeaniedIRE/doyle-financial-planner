"""Add margin detail columns to accounts table.

Revision ID: 004
Revises: 003
Create Date: 2026-05-31

Adds three new nullable columns to `accounts` so users can record the live
margin figures from their broker dashboard alongside the computed values:

  - margin_buying_power_cad   : max buying power shown by the broker
  - margin_available_cad      : cash available to withdraw / excess equity
  - margin_requirement_cad    : minimum equity the broker requires (maintenance)

All three are optional (nullable) — non-margin accounts simply leave them NULL.
SAFETY: additive only — no columns or tables are dropped.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("margin_buying_power_cad", sa.Float(), nullable=True))
    op.add_column("accounts", sa.Column("margin_available_cad",    sa.Float(), nullable=True))
    op.add_column("accounts", sa.Column("margin_requirement_cad",  sa.Float(), nullable=True))


def downgrade() -> None:
    pass  # additive-only — never drop
