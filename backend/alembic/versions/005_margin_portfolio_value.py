"""Add margin_portfolio_value_cad to accounts.

Revision ID: 005
Revises: 004
Create Date: 2026-05-31

Stores the broker-reported total portfolio value for a margin account.
This may differ slightly from the sum-of-holdings we calculate (cash balances,
pending settlements, accrued interest, etc.) and is useful as a cross-reference.

SAFETY: additive only — no columns or tables are dropped.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("margin_portfolio_value_cad", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    pass  # additive-only — never drop
