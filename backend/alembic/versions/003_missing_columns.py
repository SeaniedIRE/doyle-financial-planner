"""Add missing columns: app_settings.updated_at, income.created_at, forecast_entries.created_at.

Revision ID: 003
Revises: 002
Create Date: 2026-05-30

SAFETY RULE: additive only — no columns or tables are dropped.
Full audit of models vs migrations revealed three columns missing from the DB:
  - app_settings.updated_at      (AppSettings model, account.py)
  - income.created_at            (Income model, income.py)
  - forecast_entries.created_at  (ForecastEntry model, scenario.py)
All three cause 500 errors when the ORM tries to SELECT or INSERT them.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── app_settings ──────────────────────────────────────────────────────────
    # AppSettings model has updated_at; migration 001 only created id/key/value.
    op.add_column("app_settings", sa.Column("updated_at", sa.DateTime(), nullable=True))

    # ── income ────────────────────────────────────────────────────────────────
    # Income model has created_at; migration 001 omitted it.
    op.add_column("income", sa.Column("created_at", sa.DateTime(), nullable=True))

    # ── forecast_entries ──────────────────────────────────────────────────────
    # ForecastEntry model has created_at; neither migration 001 nor 002 added it.
    op.add_column("forecast_entries", sa.Column("created_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Downgrade intentionally drops nothing — data safety policy.
    pass
