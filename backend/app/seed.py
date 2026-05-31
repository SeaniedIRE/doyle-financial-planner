"""
Database seed — creates a generic starter structure on first run.
All account balances and income figures start at $0 and must be entered
through the application. This file contains NO personal financial data.

To add your accounts and holdings: use the Holdings page in the app UI,
or POST to /api/accounts and /api/holdings.
"""

from .database import SessionLocal
from .models.account import Account, AppSettings
from .models.scenario import Scenario
from .models.taxcheck import TaxYearCheck
from datetime import datetime, timezone


def seed_database():
    db = SessionLocal()
    try:
        if db.query(Account).first():
            return  # Already seeded — never overwrite existing data

        # ---- Generic account structure ----
        # Account numbers are placeholders. Update them in Settings after first login.
        accounts_data = [
            # Person A
            {"name": "FHSA", "account_type": "FHSA", "owner": "person_a", "account_number": "PLACEHOLDER-A-FHSA"},
            {"name": "RRSP", "account_type": "RRSP", "owner": "person_a", "account_number": "PLACEHOLDER-A-RRSP"},
            {"name": "TFSA", "account_type": "TFSA", "owner": "person_a", "account_number": "PLACEHOLDER-A-TFSA"},
            {"name": "Long Hold Margin", "account_type": "Margin", "owner": "person_a", "account_number": "PLACEHOLDER-A-MARGIN", "margin_loan_cad": 0.0, "margin_rate_pct": 3.95},
            {"name": "Long Hold Cash", "account_type": "Cash", "owner": "person_a", "account_number": "PLACEHOLDER-A-CASH"},
            # Person B
            {"name": "FHSA", "account_type": "FHSA", "owner": "person_b", "account_number": "PLACEHOLDER-B-FHSA"},
            {"name": "LIRA", "account_type": "LIRA", "owner": "person_b", "account_number": "PLACEHOLDER-B-LIRA"},
            {"name": "RRSP", "account_type": "RRSP", "owner": "person_b", "account_number": "PLACEHOLDER-B-RRSP"},
            {"name": "TFSA", "account_type": "TFSA", "owner": "person_b", "account_number": "PLACEHOLDER-B-TFSA"},
            {"name": "Long Hold Margin", "account_type": "Margin", "owner": "person_b", "account_number": "PLACEHOLDER-B-MARGIN", "margin_loan_cad": 0.0, "margin_rate_pct": 3.95},
            {"name": "Long Hold Cash", "account_type": "Cash", "owner": "person_b", "account_number": "PLACEHOLDER-B-CASH"},
            # Joint
            {"name": "Rainy Day (Emergency)", "account_type": "Joint Non-Reg", "owner": "joint", "account_number": "PLACEHOLDER-JOINT"},
        ]

        for a in accounts_data:
            acc = Account(
                name=a["name"],
                account_type=a["account_type"],
                owner=a["owner"],
                account_number=a["account_number"],
                margin_loan_cad=a.get("margin_loan_cad", 0.0),
                margin_rate_pct=a.get("margin_rate_pct", 3.95),
            )
            db.add(acc)

        # ---- Default scenarios ----
        baseline = Scenario(
            name="Baseline — Current Path",
            description="Current trajectory with all accounts growing at default rates.",
            is_baseline=True,
            growth_conservative_pct=5.0,
            growth_moderate_pct=7.0,
            growth_optimistic_pct=10.0,
            house_purchase_year=2030,
            house_price_cad=0.0,
            house_down_payment_cad=200000.0,
        )
        db.add(baseline)

        alt = Scenario(
            name="House Purchase — One Year Later",
            description="Delay house purchase by one year. One extra year of FHSA and portfolio compounding.",
            is_baseline=False,
            growth_conservative_pct=5.0,
            growth_moderate_pct=7.0,
            growth_optimistic_pct=10.0,
            house_purchase_year=2031,
            house_price_cad=0.0,
            house_down_payment_cad=200000.0,
        )
        db.add(alt)

        # ---- Tax year check for current year ----
        current_year = datetime.now().year
        db.add(TaxYearCheck(tax_year=current_year))

        # ---- App settings ----
        settings_data = [
            AppSettings(key="fx_cad_usd", value="1.3650"),
            AppSettings(key="last_holdings_update", value=""),
            AppSettings(key="person_a_canada_since", value="2009"),
            AppSettings(key="person_b_canada_since", value="2009"),
            AppSettings(key="province", value="ON"),
        ]
        for s in settings_data:
            db.add(s)

        db.commit()
        print("Database seeded with generic structure. Add your accounts and holdings through the app.")

    except Exception as e:
        db.rollback()
        print(f"Seed skipped (may already be seeded): {e}")
    finally:
        db.close()
