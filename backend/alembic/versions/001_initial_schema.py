"""Initial schema — all tables.

Revision ID: 001
Revises:
Create Date: 2026-05-30

SAFETY RULE: This migration only creates tables. It never drops existing tables or columns.
All future migrations must be ADDITIVE (new columns with defaults, new tables only).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # accounts
    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("account_type", sa.String(50), nullable=False),
        sa.Column("owner", sa.String(50), nullable=False),
        sa.Column("account_number", sa.String(50), nullable=True),
        sa.Column("margin_loan_cad", sa.Float(), nullable=True),
        sa.Column("margin_rate_pct", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_accounts_id", "accounts", ["id"])

    # holdings
    op.create_table(
        "holdings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("current_price", sa.Float(), nullable=True),
        sa.Column("book_value_cad", sa.Float(), nullable=True),
        sa.Column("market_value_cad", sa.Float(), nullable=True),
        sa.Column("price_currency", sa.String(5), nullable=True),
        sa.Column("security_type", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("last_updated", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_holdings_id", "holdings", ["id"])

    # app_settings
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(100), nullable=False, unique=True),
        sa.Column("value", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # acb_transactions
    op.create_table(
        "acb_transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("transaction_type", sa.String(20), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("price_per_share_cad", sa.Float(), nullable=False),
        sa.Column("fees_cad", sa.Float(), nullable=True),
        sa.Column("fx_rate", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_acb_transactions_id", "acb_transactions", ["id"])

    # income
    op.create_table(
        "income",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("person", sa.String(50), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("employment_income", sa.Float(), nullable=True),
        sa.Column("bonus", sa.Float(), nullable=True),
        sa.Column("other_bonus", sa.Float(), nullable=True),
        sa.Column("province", sa.String(5), nullable=True),
        sa.Column("is_maternity_leave", sa.Boolean(), nullable=True),
        sa.Column("maternity_ei_income", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # scenarios
    op.create_table(
        "scenarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_baseline", sa.Boolean(), nullable=True),
        sa.Column("growth_conservative_pct", sa.Float(), nullable=True),
        sa.Column("growth_moderate_pct", sa.Float(), nullable=True),
        sa.Column("growth_optimistic_pct", sa.Float(), nullable=True),
        sa.Column("house_purchase_year", sa.Integer(), nullable=True),
        sa.Column("house_price_cad", sa.Float(), nullable=True),
        sa.Column("house_down_payment_cad", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # scenario_assumptions
    op.create_table(
        "scenario_assumptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scenario_id", sa.Integer(), sa.ForeignKey("scenarios.id"), nullable=False),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("value", sa.String(500), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # forecast_entries
    op.create_table(
        "forecast_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scenario_id", sa.Integer(), sa.ForeignKey("scenarios.id"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("combined_net_worth_conservative", sa.Float(), nullable=True),
        sa.Column("combined_net_worth_moderate", sa.Float(), nullable=True),
        sa.Column("combined_net_worth_optimistic", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # contribution_rooms
    op.create_table(
        "contribution_rooms",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("person", sa.String(50), nullable=False),
        sa.Column("account_type", sa.String(20), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("room_available", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # persons
    op.create_table(
        "persons",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="adult"),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("canada_resident_since_year", sa.Integer(), nullable=True),
        sa.Column("province", sa.String(5), nullable=False, server_default="ON"),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("persons.id"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # family_trusts
    op.create_table(
        "family_trusts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("trust_type", sa.String(50), nullable=False, server_default="discretionary"),
        sa.Column("settled_date", sa.Date(), nullable=True),
        sa.Column("trustee_names", sa.Text(), nullable=True),
        sa.Column("beneficiary_names", sa.Text(), nullable=True),
        sa.Column("province", sa.String(5), nullable=False, server_default="ON"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # trust_assets
    op.create_table(
        "trust_assets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("trust_id", sa.Integer(), sa.ForeignKey("family_trusts.id"), nullable=False),
        sa.Column("asset_type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=True),
        sa.Column("quantity", sa.Float(), nullable=True),
        sa.Column("book_value_cad", sa.Float(), nullable=False, server_default="0"),
        sa.Column("market_value_cad", sa.Float(), nullable=False, server_default="0"),
        sa.Column("acb_per_unit_cad", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("last_updated", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # whatif_simulations
    op.create_table(
        "whatif_simulations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("override_sean_tfsa", sa.Float(), nullable=True),
        sa.Column("override_saudya_tfsa", sa.Float(), nullable=True),
        sa.Column("override_sean_rrsp", sa.Float(), nullable=True),
        sa.Column("override_saudya_rrsp", sa.Float(), nullable=True),
        sa.Column("override_sean_fhsa", sa.Float(), nullable=True),
        sa.Column("override_saudya_fhsa", sa.Float(), nullable=True),
        sa.Column("override_sean_margin", sa.Float(), nullable=True),
        sa.Column("override_saudya_margin", sa.Float(), nullable=True),
        sa.Column("override_sean_base", sa.Float(), nullable=True),
        sa.Column("override_saudya_base", sa.Float(), nullable=True),
        sa.Column("override_house_purchase_year", sa.Integer(), nullable=True),
        sa.Column("override_house_down_payment", sa.Float(), nullable=True),
        sa.Column("result_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("is_saved", sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # tax_year_checks
    op.create_table(
        "tax_year_checks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tax_year", sa.Integer(), nullable=False, unique=True),
        sa.Column("confirmed_by", sa.String(100), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("tfsa_limit_verified", sa.Boolean(), nullable=True),
        sa.Column("rrsp_limit_verified", sa.Boolean(), nullable=True),
        sa.Column("federal_brackets_verified", sa.Boolean(), nullable=True),
        sa.Column("ontario_brackets_verified", sa.Boolean(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    # Downgrade intentionally drops nothing — data safety policy.
    # To rollback schema: restore from a pre-migration backup.
    pass
