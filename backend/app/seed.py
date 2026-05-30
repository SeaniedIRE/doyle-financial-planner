"""
Seed database with Sean & Saudya's actual holdings (as of 2026-05-30).
Only runs if the database is empty.
"""

from .database import SessionLocal
from .models.account import Account, Holding, AppSettings
from .models.income import Income
from .models.scenario import Scenario
from .models.room import ContributionRoom
from datetime import datetime, timezone


def seed_database():
    db = SessionLocal()
    try:
        if db.query(Account).first():
            return  # Already seeded

        # ---- Accounts ----
        accounts_data = [
            # Sean
            {"name": "FHSA", "account_type": "FHSA", "owner": "sean", "account_number": "HQ8DKCZ60CAD"},
            {"name": "RRSP", "account_type": "RRSP", "owner": "sean", "account_number": "HQ8GW7S44CAD"},
            {"name": "TFSA", "account_type": "TFSA", "owner": "sean", "account_number": "HQ8DKCMK3CAD"},
            {"name": "💎 Long Hold Margin", "account_type": "Margin", "owner": "sean", "account_number": "HQ8DFPK06CAD", "margin_loan_cad": 100000.0, "margin_rate_pct": 3.95},
            {"name": "💎 Long Hold Cash", "account_type": "Cash", "owner": "sean", "account_number": "HQBRBJM07CAD"},
            # Saudya
            {"name": "FHSA", "account_type": "FHSA", "owner": "saudya", "account_number": "HQ8GLRG60CAD"},
            {"name": "LIRA", "account_type": "LIRA", "owner": "saudya", "account_number": "HQ8HC5WN1CAD"},
            {"name": "RRSP", "account_type": "RRSP", "owner": "saudya", "account_number": "HQ8DNS847CAD"},
            {"name": "TFSA", "account_type": "TFSA", "owner": "saudya", "account_number": "HQ8DNS5K4CAD"},
            {"name": "💎 Long Hold Margin", "account_type": "Margin", "owner": "saudya", "account_number": "HQ8GLRD06CAD", "margin_loan_cad": 100000.0, "margin_rate_pct": 3.95},
            {"name": "💎 Long Hold Cash", "account_type": "Cash", "owner": "saudya", "account_number": "HQBRBNG05CAD"},
            # Joint
            {"name": "☔️ Rainy Day (Emergency)", "account_type": "Joint Non-Reg", "owner": "joint", "account_number": "HQ8DNSD09CAD"},
        ]

        account_map = {}
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
            db.flush()
            account_map[a["account_number"]] = acc.id

        # ---- Holdings as of 2026-05-30 ----
        holdings_data = [
            # Sean FHSA
            {"acct": "HQ8DKCZ60CAD", "symbol": "HEWB", "name": "Global X Equal Weight Canadian Banks ETF", "qty": 260, "price": 66.24, "book": 14554.80, "market": 17222.40, "currency": "CAD"},
            {"acct": "HQ8DKCZ60CAD", "symbol": "VFV", "name": "Vanguard S&P 500 Index ETF", "qty": 130.8094, "price": 185.61, "book": 20497.56, "market": 24279.532734, "currency": "CAD"},
            # Sean RRSP
            {"acct": "HQ8GW7S44CAD", "symbol": "VFV", "name": "Vanguard S&P 500 Index ETF", "qty": 250.7757, "price": 185.61, "book": 32127.08, "market": 46546.477677, "currency": "CAD"},
            {"acct": "HQ8GW7S44CAD", "symbol": "XEQT", "name": "iShares Core Equity ETF Portfolio", "qty": 3472.5396, "price": 44.495, "book": 102776.79, "market": 154510.649502, "currency": "CAD"},
            # Sean TFSA
            {"acct": "HQ8DKCMK3CAD", "symbol": "VFV", "name": "Vanguard S&P 500 Index ETF", "qty": 395.6037, "price": 185.61, "book": 54417.73, "market": 73428.002757, "currency": "CAD"},
            {"acct": "HQ8DKCMK3CAD", "symbol": "XEQT", "name": "iShares Core Equity ETF Portfolio", "qty": 146.3946, "price": 44.495, "book": 4307.03, "market": 6513.827727, "currency": "CAD"},
            # Sean Margin
            {"acct": "HQ8DFPK06CAD", "symbol": "HULC", "name": "Global X US Large Cap Index Corporate Class ETF", "qty": 315, "price": 128.28, "book": 36391.38, "market": 40408.20, "currency": "CAD"},
            {"acct": "HQ8DFPK06CAD", "symbol": "HXDM", "name": "Global X Intl Developed Markets Equity Index Corporate Class ETF", "qty": 401, "price": 64.00, "book": 24045.55, "market": 25664.00, "currency": "CAD"},
            {"acct": "HQ8DFPK06CAD", "symbol": "HXEM", "name": "Global X Emerging Markets Equity Index Corporate Class ETF", "qty": 194, "price": 59.67, "book": 9589.42, "market": 11575.98, "currency": "CAD"},
            {"acct": "HQ8DFPK06CAD", "symbol": "HXQ", "name": "Global X Nasdaq-100 Index Corporate Class ETF", "qty": 107, "price": 120.25, "book": 10738.58, "market": 12866.75, "currency": "CAD"},
            {"acct": "HQ8DFPK06CAD", "symbol": "HXT", "name": "Global X S&P/TSX 60 Index Corporate Class ETF", "qty": 234, "price": 90.86, "book": 19691.23, "market": 21261.24, "currency": "CAD"},
            # PSNY — stored in CAD equivalent; market value converted at ~1.366 CAD/USD
            {"acct": "HQ8DFPK06CAD", "symbol": "PSNY", "name": "Polestar Automotive Holding UK PLC", "qty": 206.5, "price": 31.50, "book": 17570.32, "market": 6504.25, "currency": "CAD",
             "notes": "USD position. Book $17,570.32 CAD. Market ~$4,764 USD at ~1.366 CAD/USD. Large unrealized loss — review loss harvesting."},
            # Saudya FHSA
            {"acct": "HQ8GLRG60CAD", "symbol": "VFV", "name": "Vanguard S&P 500 Index ETF", "qty": 220.191, "price": 185.61, "book": 35212.76, "market": 40869.65151, "currency": "CAD"},
            # Saudya LIRA
            {"acct": "HQ8HC5WN1CAD", "symbol": "VFV", "name": "Vanguard S&P 500 Index ETF", "qty": 16.1139, "price": 185.61, "book": 1721.21, "market": 2990.900979, "currency": "CAD"},
            {"acct": "HQ8HC5WN1CAD", "symbol": "XEQT", "name": "iShares Core Equity ETF Portfolio", "qty": 529.1789, "price": 44.495, "book": 13812.08, "market": 23545.8151555, "currency": "CAD"},
            # Saudya RRSP
            {"acct": "HQ8DNS847CAD", "symbol": "VFV", "name": "Vanguard S&P 500 Index ETF", "qty": 103.5775, "price": 185.61, "book": 13941.21, "market": 19225.019775, "currency": "CAD"},
            {"acct": "HQ8DNS847CAD", "symbol": "XEQT", "name": "iShares Core Equity ETF Portfolio", "qty": 2156.1576, "price": 44.495, "book": 62065.05, "market": 95938.232412, "currency": "CAD"},
            # Saudya TFSA
            {"acct": "HQ8DNS5K4CAD", "symbol": "VFV", "name": "Vanguard S&P 500 Index ETF", "qty": 378.914, "price": 185.61, "book": 54280.14, "market": 70330.22754, "currency": "CAD"},
            {"acct": "HQ8DNS5K4CAD", "symbol": "XEQT", "name": "iShares Core Equity ETF Portfolio", "qty": 1930.7552, "price": 44.495, "book": 62895.83, "market": 85908.952624, "currency": "CAD"},
            # Saudya Margin
            {"acct": "HQ8GLRD06CAD", "symbol": "HULC", "name": "Global X US Large Cap Index Corporate Class ETF", "qty": 329, "price": 128.28, "book": 38153.23, "market": 42204.12, "currency": "CAD"},
            {"acct": "HQ8GLRD06CAD", "symbol": "HXDM", "name": "Global X Intl Developed Markets Equity Index Corporate Class ETF", "qty": 414, "price": 64.00, "book": 24825.52, "market": 26496.00, "currency": "CAD"},
            {"acct": "HQ8GLRD06CAD", "symbol": "HXEM", "name": "Global X Emerging Markets Equity Index Corporate Class ETF", "qty": 195, "price": 59.67, "book": 9623.34, "market": 11635.65, "currency": "CAD"},
            {"acct": "HQ8GLRD06CAD", "symbol": "HXQ", "name": "Global X Nasdaq-100 Index Corporate Class ETF", "qty": 106, "price": 120.25, "book": 10668.90, "market": 12746.50, "currency": "CAD"},
            {"acct": "HQ8GLRD06CAD", "symbol": "HXT", "name": "Global X S&P/TSX 60 Index Corporate Class ETF", "qty": 234, "price": 90.86, "book": 19690.97, "market": 21261.24, "currency": "CAD"},
            # Joint Emergency
            {"acct": "HQ8DNSD09CAD", "symbol": "HEWB", "name": "Global X Equal Weight Canadian Banks ETF", "qty": 894, "price": 66.24, "book": 50010.36, "market": 59218.56, "currency": "CAD"},
        ]

        for h in holdings_data:
            holding = Holding(
                account_id=account_map[h["acct"]],
                symbol=h["symbol"],
                name=h["name"],
                quantity=h["qty"],
                current_price=h["price"],
                book_value_cad=h["book"],
                market_value_cad=h["market"],
                price_currency=h.get("currency", "CAD"),
                security_type="ETF" if h["symbol"] != "PSNY" else "Equity",
                notes=h.get("notes", ""),
                last_updated=datetime(2026, 5, 30, tzinfo=timezone.utc),
            )
            db.add(holding)

        # ---- Income 2026 ----
        incomes = [
            Income(
                person="sean", year=2026,
                employment_income=245000, bonus=65000, other_bonus=15000,
                province="ON",
                notes="Base $245K + Bonus $65K + Extra bonus $15K",
            ),
            Income(
                person="saudya", year=2026,
                employment_income=106000, bonus=15000,
                province="ON",
                notes="Base $106K + Bonus $15K",
            ),
            # 2027 — Saudya maternity leave
            Income(
                person="sean", year=2027,
                employment_income=254800, bonus=67600, other_bonus=15600,
                province="ON", notes="Projected +4% salary growth",
            ),
            Income(
                person="saudya", year=2027,
                employment_income=27560, bonus=0,
                province="ON", is_maternity_leave=True, maternity_ei_income=35167,
                notes="Maternity leave early 2027 — ~25% employment income + EI benefits",
            ),
            # 2028 — Saudya second leave
            Income(
                person="sean", year=2028,
                employment_income=264992, bonus=70304, other_bonus=16224,
                province="ON", notes="Projected +4%",
            ),
            Income(
                person="saudya", year=2028,
                employment_income=55360, bonus=0,
                province="ON", is_maternity_leave=True, maternity_ei_income=35167,
                notes="Second mat leave Sep 2028 — partial year income + EI",
            ),
        ]
        for inc in incomes:
            db.add(inc)

        # ---- Contribution Room 2026 ----
        rooms = [
            ContributionRoom(person="sean", account_type="TFSA", year=2026, room_available=7000,
                             notes="Annual room. Sean in Canada from May 2018. Check CRA My Account for cumulative unused room."),
            ContributionRoom(person="sean", account_type="RRSP", year=2026, room_available=32490,
                             notes="2026 max limit. Actual room = 18% × 2025 earned income. Check CRA My Account."),
            ContributionRoom(person="sean", account_type="FHSA", year=2026, room_available=8000,
                             notes="One remaining contribution year. Lifetime limit $40K."),
            ContributionRoom(person="saudya", account_type="TFSA", year=2026, room_available=7000,
                             notes="Annual room. Check CRA My Account for cumulative unused room."),
            ContributionRoom(person="saudya", account_type="RRSP", year=2026, room_available=22000,
                             notes="Based on 18% × ~$121K. Check CRA My Account for exact room."),
            ContributionRoom(person="saudya", account_type="FHSA", year=2026, room_available=8000,
                             notes="One remaining contribution year. Lifetime limit $40K."),
        ]
        for r in rooms:
            db.add(r)

        # ---- Default Scenario ----
        baseline = Scenario(
            name="Baseline — Current Path",
            description="Current trajectory: all accounts maxed 2026, FHSA final $8K contribution, house purchase 2030, Saudya maternity leaves 2027 and 2028.",
            is_baseline=True,
            growth_conservative_pct=5.0,
            growth_moderate_pct=7.0,
            growth_optimistic_pct=10.0,
            house_purchase_year=2030,
            house_price_cad=900000.0,
            house_down_payment_cad=200000.0,
        )
        db.add(baseline)

        alt = Scenario(
            name="House 2031 — Extra Year of Growth",
            description="Delay house purchase to 2031. One extra year of FHSA/portfolio compounding.",
            is_baseline=False,
            growth_conservative_pct=5.0,
            growth_moderate_pct=7.0,
            growth_optimistic_pct=10.0,
            house_purchase_year=2031,
            house_price_cad=950000.0,
            house_down_payment_cad=200000.0,
        )
        db.add(alt)

        # ---- App Settings ----
        settings_data = [
            AppSettings(key="fx_cad_usd", value="1.3650"),
            AppSettings(key="last_holdings_update", value="2026-05-30"),
            AppSettings(key="sean_canada_since", value="2018"),
            AppSettings(key="saudya_canada_since", value="2009"),
            AppSettings(key="province", value="ON"),
        ]
        for s in settings_data:
            db.add(s)

        db.commit()
        print("✅ Database seeded with Sean & Saudya's holdings as of 2026-05-30")

    except Exception as e:
        db.rollback()
        print(f"Seed error (may already be seeded): {e}")
    finally:
        db.close()
