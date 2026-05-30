from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..services.tax_engine import (
    calculate_annual_tax, tfsa_room_to_date, rrsp_room,
    TFSA_LIMITS, RRSP_LIMITS, FHSA_ANNUAL_LIMIT, FHSA_LIFETIME_LIMIT,
    ei_maternity_benefit, margin_interest_deduction,
)
from ..models.income import Income

router = APIRouter(prefix="/api/tax", tags=["tax"])


class TaxCalcRequest(BaseModel):
    year: int = 2026
    person: str = "sean"
    employment_income: float = 0
    bonus: float = 0
    other_bonus: float = 0
    investment_income: float = 0
    capital_gains_realized: float = 0
    eligible_dividends: float = 0
    other_income: float = 0
    rrsp_deduction: float = 0
    margin_interest_deduction: float = 0
    province: str = "ON"
    is_maternity_leave: bool = False
    maternity_ei_income: float = 0


@router.post("/calculate")
def calculate_tax(req: TaxCalcRequest):
    result = calculate_annual_tax(
        year=req.year,
        employment_income=req.employment_income,
        bonus=req.bonus,
        other_bonus=req.other_bonus,
        investment_income=req.investment_income,
        capital_gains_realized=req.capital_gains_realized,
        eligible_dividends=req.eligible_dividends,
        other_income=req.other_income,
        rrsp_deduction=req.rrsp_deduction,
        margin_interest_deduction=req.margin_interest_deduction,
        province=req.province,
        is_maternity_leave=req.is_maternity_leave,
        maternity_ei_income=req.maternity_ei_income,
    )
    return {
        "gross_income": result.gross_income,
        "taxable_income": result.taxable_income,
        "rrsp_deduction": result.rrsp_deduction,
        "federal_tax": result.federal_tax,
        "provincial_tax": result.provincial_tax,
        "total_tax": result.total_tax,
        "average_rate_pct": result.average_rate,
        "marginal_federal_pct": result.marginal_federal,
        "marginal_provincial_pct": result.marginal_provincial,
        "combined_marginal_pct": result.combined_marginal,
        "after_tax_income": result.after_tax_income,
        "capital_gains_tax": result.capital_gains_tax,
        "province": result.province,
        "year": result.year,
        "breakdown": result.breakdown,
        "notes": [
            "Capital gains inclusion rate: 50% (CRA 2026 — ITA s.38)",
            "Basic personal amount federal: $15,705",
            "Basic personal amount Ontario: $11,865",
            "Eligible dividend gross-up: 38%, federal credit: 15.02%, Ontario credit: 10%",
        ]
    }


@router.get("/comparison/{year}")
def tax_comparison(year: int = 2026, db: Session = Depends(get_db)):
    """Compare Sean vs Saudya tax situation side by side."""
    for person in ["sean", "saudya"]:
        inc = db.query(Income).filter(Income.person == person, Income.year == year).first()
    results = {}
    for person in ["sean", "saudya"]:
        inc = db.query(Income).filter(Income.person == person, Income.year == year).first()
        if inc:
            r = calculate_annual_tax(
                year=year,
                employment_income=inc.employment_income,
                bonus=inc.bonus,
                other_bonus=inc.other_bonus,
                province=inc.province,
                is_maternity_leave=inc.is_maternity_leave,
                maternity_ei_income=inc.maternity_ei_income,
            )
            results[person] = {
                "gross": r.gross_income,
                "tax": r.total_tax,
                "after_tax": r.after_tax_income,
                "marginal_pct": r.combined_marginal,
                "average_pct": r.average_rate,
            }
    return results


@router.get("/contribution-room/{person}/{year}")
def contribution_room(person: str, year: int, canada_since: int = 2018):
    """Calculate contribution room for a person and year."""
    tfsa = tfsa_room_to_date(year, canada_since)
    rrsp_lim = RRSP_LIMITS.get(year, 32490)
    fhsa_annual = FHSA_ANNUAL_LIMIT
    return {
        "tfsa_cumulative_room": tfsa,
        "tfsa_annual_new_room": TFSA_LIMITS.get(year, 7000),
        "rrsp_max_limit": rrsp_lim,
        "rrsp_18pct_note": "Actual room = 18% of prior year earned income, up to the limit. Check CRA My Account for exact room.",
        "fhsa_annual_limit": fhsa_annual,
        "fhsa_lifetime_limit": FHSA_LIFETIME_LIMIT,
        "fhsa_carryforward": "Up to $8,000 unused room carries forward to next year (1 year only)",
        "person": person,
        "year": year,
    }


@router.get("/maternity-ei/{year}")
def maternity_ei(year: int, insurable_earnings: float = 65700, weeks: int = 35):
    benefit = ei_maternity_benefit(insurable_earnings, year, weeks)
    return {
        "annual_ei_benefit": benefit,
        "weekly_benefit": round(benefit / weeks, 2),
        "weeks": weeks,
        "insurable_earnings_used": min(insurable_earnings, 65700),
        "benefit_rate_pct": 55,
        "note": "EI benefits are taxable income. Extended parental leave (18 months) pays 33% rate. Check Service Canada for current rates.",
    }
