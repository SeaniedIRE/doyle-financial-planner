"""Schema alignment — add columns missing from migration 001 to match current models.

Revision ID: 002
Revises: 001
Create Date: 2026-05-30

SAFETY RULE: additive only — no columns or tables are dropped.
Migration 001 had several columns missing and one table name wrong
(contribution_rooms vs contribution_room). This migration brings the
live schema into full alignment with the SQLAlchemy models.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── accounts ──────────────────────────────────────────────────────────────
    # Model added: currency, is_active, updated_at
    op.add_column("accounts", sa.Column("currency",    sa.String(10),  server_default="CAD"))
    op.add_column("accounts", sa.Column("is_active",   sa.Boolean(),   server_default="1"))
    op.add_column("accounts", sa.Column("updated_at",  sa.DateTime(),  nullable=True))

    # ── holdings ──────────────────────────────────────────────────────────────
    # Model added: exchange, is_active
    op.add_column("holdings", sa.Column("exchange",  sa.String(20),  server_default="TSX"))
    op.add_column("holdings", sa.Column("is_active", sa.Boolean(),   server_default="1"))

    # ── acb_transactions ──────────────────────────────────────────────────────
    # Migration 001 linked to account_id; the model uses holding_id.
    # Add the model's columns — old account_id / symbol columns stay (never drop).
    op.add_column("acb_transactions", sa.Column("holding_id",           sa.Integer(), nullable=True))
    op.add_column("acb_transactions", sa.Column("total_cost_cad",       sa.Float(),   server_default="0"))
    op.add_column("acb_transactions", sa.Column("acb_per_share_after",  sa.Float(),   server_default="0"))
    op.add_column("acb_transactions", sa.Column("total_acb_after",      sa.Float(),   server_default="0"))
    op.add_column("acb_transactions", sa.Column("capital_gain_loss_cad", sa.Float(),  server_default="0"))

    # ── income ────────────────────────────────────────────────────────────────
    # Model added: investment_income, rental_income, other_income, updated_at
    op.add_column("income", sa.Column("investment_income", sa.Float(),   server_default="0"))
    op.add_column("income", sa.Column("rental_income",     sa.Float(),   server_default="0"))
    op.add_column("income", sa.Column("other_income",      sa.Float(),   server_default="0"))
    op.add_column("income", sa.Column("updated_at",        sa.DateTime(), nullable=True))

    # ── scenarios ─────────────────────────────────────────────────────────────
    # Model added: assumptions (JSON), is_active, updated_at
    op.add_column("scenarios", sa.Column("assumptions", sa.JSON(),     nullable=True))
    op.add_column("scenarios", sa.Column("is_active",   sa.Boolean(),  server_default="1"))
    op.add_column("scenarios", sa.Column("updated_at",  sa.DateTime(), nullable=True))

    # ── forecast_entries ──────────────────────────────────────────────────────
    # Migration 001 used combined_net_worth_* names; model uses net_worth_*.
    # Add model column names — old combined_net_worth_* stay (never drop).
    op.add_column("forecast_entries", sa.Column("account_id",           sa.Integer(),     nullable=True))
    op.add_column("forecast_entries", sa.Column("account_type",         sa.String(50),    nullable=True))
    op.add_column("forecast_entries", sa.Column("person",               sa.String(50),    nullable=True))
    op.add_column("forecast_entries", sa.Column("value_conservative",   sa.Float(),       server_default="0"))
    op.add_column("forecast_entries", sa.Column("value_moderate",       sa.Float(),       server_default="0"))
    op.add_column("forecast_entries", sa.Column("value_optimistic",     sa.Float(),       server_default="0"))
    op.add_column("forecast_entries", sa.Column("net_worth_conservative", sa.Float(),     server_default="0"))
    op.add_column("forecast_entries", sa.Column("net_worth_moderate",   sa.Float(),       server_default="0"))
    op.add_column("forecast_entries", sa.Column("net_worth_optimistic", sa.Float(),       server_default="0"))
    op.add_column("forecast_entries", sa.Column("tax_paid_est",         sa.Float(),       server_default="0"))

    # ── contribution_room ─────────────────────────────────────────────────────
    # Migration 001 created contribution_rooms (plural); model tablename is
    # contribution_room (singular). Create the correct table here so alembic
    # tracks it. The old contribution_rooms table stays but is unused.
    op.create_table(
        "contribution_room",
        sa.Column("id",              sa.Integer(),    nullable=False),
        sa.Column("person",          sa.String(50),   nullable=False),
        sa.Column("account_type",    sa.String(20),   nullable=False),
        sa.Column("year",            sa.Integer(),    nullable=False),
        sa.Column("room_available",  sa.Float(),      nullable=True),
        sa.Column("contributed_ytd", sa.Float(),      server_default="0"),
        sa.Column("withdrawn_ytd",   sa.Float(),      server_default="0"),
        sa.Column("notes",           sa.String(500),  nullable=True),
        sa.Column("updated_at",      sa.DateTime(),   nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    # Downgrade intentionally drops nothing — data safety policy.
    pass
