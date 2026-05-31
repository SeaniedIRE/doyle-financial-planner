"""Add override_sean_cash and override_saudya_cash to whatif_simulations.

Revision ID: 006
Revises: 005
Create Date: 2026-05-31

Allows the What-If simulator to model scenarios where Cash (non-registered)
accounts start from a user-specified value rather than the current DB balance.
Useful for modelling "what if I put $100k into a cash account from scratch?"

SAFETY: additive only — no columns or tables are dropped.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("whatif_simulations", sa.Column("override_sean_cash",   sa.Float(), nullable=True))
    op.add_column("whatif_simulations", sa.Column("override_saudya_cash", sa.Float(), nullable=True))


def downgrade() -> None:
    pass  # additive-only — never drop
