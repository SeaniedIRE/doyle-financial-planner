"""
Annual Tax Year Check API — prompts users to verify CRA rule changes each year.
GET  /api/taxcheck/               — get current year's verification status
GET  /api/taxcheck/{year}         — get specific year's status
POST /api/taxcheck/{year}/confirm — mark a year's rules as confirmed
GET  /api/taxcheck/cra-links      — return CRA reference URLs

CRA References:
  https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/canadian-income-tax-rates-individuals-current-previous-years.html
  https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/contributions.html
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from ..database import get_db
from ..models.taxcheck import TaxYearCheck

router = APIRouter(prefix="/api/taxcheck", tags=["taxcheck"])

CRA_LINKS = [
    {
        "label": "Federal income tax rates (current year)",
        "url": "https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/canadian-income-tax-rates-individuals-current-previous-years.html",
        "section": "Federal brackets",
    },
    {
        "label": "Ontario tax rates and credits",
        "url": "https://www.ontario.ca/page/ontario-tax-credits-and-benefits",
        "section": "Ontario brackets",
    },
    {
        "label": "TFSA contribution limits (ITA s.146.2)",
        "url": "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/contributions.html",
        "section": "TFSA limits",
    },
    {
        "label": "RRSP contribution limit (ITA s.146)",
        "url": "https://www.canada.ca/en/revenue-agency/news/newsroom/tax-tips/tax-tips-2025/rrsp-contribution-limit.html",
        "section": "RRSP limits",
    },
    {
        "label": "Capital gains inclusion rate (ITA s.38)",
        "url": "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains.html",
        "section": "Capital gains",
    },
    {
        "label": "First Home Savings Account (ITA s.146.6)",
        "url": "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/first-home-savings-account.html",
        "section": "FHSA",
    },
    {
        "label": "ACB — Adjusted Cost Base rules",
        "url": "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains/calculating-reporting-your-capital-gains-losses/adjusted-cost-base.html",
        "section": "ACB",
    },
    {
        "label": "Superficial loss rule (ITA s.54)",
        "url": "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains/calculating-reporting-your-capital-gains-losses/superficial-losses.html",
        "section": "Superficial loss",
    },
    {
        "label": "Margin interest deduction (ITA s.20(1)(c))",
        "url": "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses/claiming-capital-cost-allowance/eligible-capital-expenditures/interest-financing-charges.html",
        "section": "Margin interest",
    },
]


class ConfirmRequest(BaseModel):
    confirmed_by: Optional[str] = None
    tfsa_limit_verified: bool = False
    rrsp_limit_verified: bool = False
    federal_brackets_verified: bool = False
    ontario_brackets_verified: bool = False
    notes: Optional[str] = None


@router.get("/cra-links")
def get_cra_links():
    return CRA_LINKS


@router.get("/")
def get_current_year_check(db: Session = Depends(get_db)):
    current_year = datetime.now().year
    check = db.query(TaxYearCheck).filter(TaxYearCheck.tax_year == current_year).first()
    if not check:
        check = TaxYearCheck(tax_year=current_year)
        db.add(check)
        db.commit()
        db.refresh(check)
    return {
        "tax_year": check.tax_year,
        "fully_verified": check.fully_verified,
        "tfsa_limit_verified": check.tfsa_limit_verified,
        "rrsp_limit_verified": check.rrsp_limit_verified,
        "federal_brackets_verified": check.federal_brackets_verified,
        "ontario_brackets_verified": check.ontario_brackets_verified,
        "confirmed_by": check.confirmed_by,
        "confirmed_at": check.confirmed_at,
        "notes": check.notes,
    }


@router.get("/{year}")
def get_year_check(year: int, db: Session = Depends(get_db)):
    check = db.query(TaxYearCheck).filter(TaxYearCheck.tax_year == year).first()
    if not check:
        return {"tax_year": year, "fully_verified": False, "message": "No verification record for this year"}
    return {
        "tax_year": check.tax_year,
        "fully_verified": check.fully_verified,
        "tfsa_limit_verified": check.tfsa_limit_verified,
        "rrsp_limit_verified": check.rrsp_limit_verified,
        "federal_brackets_verified": check.federal_brackets_verified,
        "ontario_brackets_verified": check.ontario_brackets_verified,
        "confirmed_by": check.confirmed_by,
        "confirmed_at": check.confirmed_at,
    }


@router.post("/{year}/confirm")
def confirm_year(year: int, body: ConfirmRequest, db: Session = Depends(get_db)):
    check = db.query(TaxYearCheck).filter(TaxYearCheck.tax_year == year).first()
    if not check:
        check = TaxYearCheck(tax_year=year)
        db.add(check)

    check.tfsa_limit_verified = body.tfsa_limit_verified
    check.rrsp_limit_verified = body.rrsp_limit_verified
    check.federal_brackets_verified = body.federal_brackets_verified
    check.ontario_brackets_verified = body.ontario_brackets_verified
    check.confirmed_by = body.confirmed_by
    check.confirmed_at = datetime.now(timezone.utc)
    check.notes = body.notes

    db.commit()
    db.refresh(check)
    return {
        "tax_year": check.tax_year,
        "fully_verified": check.fully_verified,
        "confirmed_at": check.confirmed_at,
    }
