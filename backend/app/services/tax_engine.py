"""
Canadian Tax Engine — CRA rules for 2024–2030+
Federal and Ontario provincial brackets, RRSP/TFSA/FHSA rules.
"""

from dataclasses import dataclass
from typing import Optional


# ---------------------------------------------------------------------------
# Tax brackets — update each year via FEDERAL_BRACKETS / PROV_BRACKETS dicts
# ---------------------------------------------------------------------------

FEDERAL_BRACKETS = {
    2024: [(57375, 0.15), (57375, 0.205), (63776, 0.26), (70245, 0.29), (float("inf"), 0.33)],
    2025: [(57375, 0.15), (57375, 0.205), (63776, 0.26), (70245, 0.29), (float("inf"), 0.33)],
    2026: [(57375, 0.15), (57375, 0.205), (63776, 0.26), (70245, 0.29), (float("inf"), 0.33)],
    2027: [(57375, 0.15), (57375, 0.205), (63776, 0.26), (70245, 0.29), (float("inf"), 0.33)],
    2028: [(57375, 0.15), (57375, 0.205), (63776, 0.26), (70245, 0.29), (float("inf"), 0.33)],
    2029: [(57375, 0.15), (57375, 0.205), (63776, 0.26), (70245, 0.29), (float("inf"), 0.33)],
    2030: [(57375, 0.15), (57375, 0.205), (63776, 0.26), (70245, 0.29), (float("inf"), 0.33)],
}

ONTARIO_BRACKETS = {
    2024: [(51446, 0.0505), (51448, 0.0915), (47728, 0.1116), (70000, 0.1216), (float("inf"), 0.1316)],
    2025: [(51446, 0.0505), (51448, 0.0915), (47728, 0.1116), (70000, 0.1216), (float("inf"), 0.1316)],
    2026: [(51446, 0.0505), (51448, 0.0915), (47728, 0.1116), (70000, 0.1216), (float("inf"), 0.1316)],
    2027: [(51446, 0.0505), (51448, 0.0915), (47728, 0.1116), (70000, 0.1216), (float("inf"), 0.1316)],
    2028: [(51446, 0.0505), (51448, 0.0915), (47728, 0.1116), (70000, 0.1216), (float("inf"), 0.1316)],
    2029: [(51446, 0.0505), (51448, 0.0915), (47728, 0.1116), (70000, 0.1216), (float("inf"), 0.1316)],
    2030: [(51446, 0.0505), (51448, 0.0915), (47728, 0.1116), (70000, 0.1216), (float("inf"), 0.1316)],
}

# RRSP annual dollar limits
RRSP_LIMITS = {
    2024: 31560, 2025: 32490, 2026: 32490, 2027: 33000,
    2028: 33500, 2029: 34000, 2030: 34500,
}

# TFSA annual limits
TFSA_LIMITS = {
    2009: 5000, 2010: 5000, 2011: 5000, 2012: 5000, 2013: 5500, 2014: 5500,
    2015: 10000, 2016: 5500, 2017: 5500, 2018: 5500, 2019: 6000, 2020: 6000,
    2021: 6000, 2022: 6000, 2023: 6500, 2024: 7000, 2025: 7000, 2026: 7000,
    2027: 7000, 2028: 7000, 2029: 7000, 2030: 7000,
}

FHSA_ANNUAL_LIMIT = 8000
FHSA_LIFETIME_LIMIT = 40000

# EI max insurable earnings and benefit rate for maternity
EI_MAX_INSURABLE = {2026: 65700, 2027: 67000, 2028: 68500}
EI_BENEFIT_RATE = 0.55  # 55% of insurable earnings (basic)
EI_MAX_WEEKS = 35  # maternity + parental combined standard


def calculate_tax(income: float, brackets: list[tuple]) -> float:
    """Apply progressive brackets to income. Returns total tax."""
    tax = 0.0
    remaining = income
    for bracket_size, rate in brackets:
        if remaining <= 0:
            break
        taxable = min(remaining, bracket_size)
        tax += taxable * rate
        remaining -= taxable
    return tax


def marginal_rate(income: float, brackets: list[tuple]) -> float:
    """Return the marginal rate at a given income level."""
    cumulative = 0.0
    for bracket_size, rate in brackets:
        cumulative += bracket_size
        if income <= cumulative:
            return rate
    return brackets[-1][1]


@dataclass
class TaxResult:
    gross_income: float
    taxable_income: float
    rrsp_deduction: float
    federal_tax: float
    provincial_tax: float
    total_tax: float
    average_rate: float
    marginal_federal: float
    marginal_provincial: float
    combined_marginal: float
    after_tax_income: float
    capital_gains_tax: float
    province: str
    year: int
    breakdown: dict


def calculate_annual_tax(
    year: int,
    employment_income: float,
    bonus: float = 0,
    other_bonus: float = 0,
    investment_income: float = 0,
    capital_gains_realized: float = 0,
    eligible_dividends: float = 0,
    other_income: float = 0,
    rrsp_deduction: float = 0,
    margin_interest_deduction: float = 0,
    province: str = "ON",
    is_maternity_leave: bool = False,
    maternity_ei_income: float = 0,
) -> TaxResult:
    """
    Full Canadian tax calculation for a given year.

    Capital gains inclusion rate: 50% (as per CRA rules in effect 2026).
    Eligible dividend gross-up: 38%, federal tax credit: 15.02%, Ontario credit: 10%.
    """
    brackets_fed = FEDERAL_BRACKETS.get(year, FEDERAL_BRACKETS[2026])
    brackets_prov = ONTARIO_BRACKETS.get(year, ONTARIO_BRACKETS[2026])

    total_employment = employment_income + bonus + other_bonus
    if is_maternity_leave:
        total_employment += maternity_ei_income

    capital_gains_included = capital_gains_realized * 0.50  # 50% inclusion rate (CRA 2026)

    eligible_div_grossup = eligible_dividends * 1.38
    gross_income = total_employment + investment_income + capital_gains_included + eligible_div_grossup + other_income

    taxable_income = max(0, gross_income - rrsp_deduction - margin_interest_deduction)

    basic_personal_fed = 15705  # 2026 federal basic personal amount
    basic_personal_prov = 11865  # 2026 Ontario basic personal amount

    federal_tax_gross = calculate_tax(max(0, taxable_income - basic_personal_fed), brackets_fed)
    provincial_tax_gross = calculate_tax(max(0, taxable_income - basic_personal_prov), brackets_prov)

    # Eligible dividend tax credits
    fed_div_credit = eligible_dividends * 0.1502
    prov_div_credit = eligible_dividends * 0.10  # Ontario
    federal_tax = max(0, federal_tax_gross - fed_div_credit)
    provincial_tax = max(0, provincial_tax_gross - prov_div_credit)

    total_tax = federal_tax + provincial_tax

    # Capital gains portion of tax (for reporting)
    fed_cg_tax = calculate_tax(max(0, taxable_income - basic_personal_fed), brackets_fed) - \
                 calculate_tax(max(0, taxable_income - basic_personal_fed - capital_gains_included), brackets_fed)
    prov_cg_tax = calculate_tax(max(0, taxable_income - basic_personal_prov), brackets_prov) - \
                  calculate_tax(max(0, taxable_income - basic_personal_prov - capital_gains_included), brackets_prov)
    capital_gains_tax = max(0, fed_cg_tax + prov_cg_tax)

    avg_rate = (total_tax / gross_income * 100) if gross_income > 0 else 0
    marg_fed = marginal_rate(taxable_income - basic_personal_fed, brackets_fed)
    marg_prov = marginal_rate(taxable_income - basic_personal_prov, brackets_prov)

    return TaxResult(
        gross_income=gross_income,
        taxable_income=taxable_income,
        rrsp_deduction=rrsp_deduction,
        federal_tax=round(federal_tax, 2),
        provincial_tax=round(provincial_tax, 2),
        total_tax=round(total_tax, 2),
        average_rate=round(avg_rate, 2),
        marginal_federal=round(marg_fed * 100, 2),
        marginal_provincial=round(marg_prov * 100, 2),
        combined_marginal=round((marg_fed + marg_prov) * 100, 2),
        after_tax_income=round(gross_income - total_tax, 2),
        capital_gains_tax=round(capital_gains_tax, 2),
        province=province,
        year=year,
        breakdown={
            "employment_income": total_employment,
            "investment_income": investment_income,
            "capital_gains_realized": capital_gains_realized,
            "capital_gains_included_50pct": capital_gains_included,
            "eligible_dividends": eligible_dividends,
            "eligible_dividends_grossed_up": eligible_div_grossup,
            "other_income": other_income,
            "rrsp_deduction": rrsp_deduction,
            "margin_interest_deduction": margin_interest_deduction,
            "basic_personal_federal": basic_personal_fed,
            "basic_personal_provincial": basic_personal_prov,
            "federal_dividend_credit": fed_div_credit,
            "provincial_dividend_credit": prov_div_credit,
        }
    )


def tfsa_room_to_date(year: int, canada_resident_since_year: int) -> float:
    """Calculate cumulative TFSA room from residency start through given year."""
    total = 0.0
    for y in range(max(2009, canada_resident_since_year), year + 1):
        total += TFSA_LIMITS.get(y, 7000)
    return total


def rrsp_room(year: int, prior_year_earned_income: float) -> float:
    """RRSP contribution room for a given year based on prior year income."""
    limit = RRSP_LIMITS.get(year, 32490)
    return min(prior_year_earned_income * 0.18, limit)


def ei_maternity_benefit(insurable_earnings: float, year: int, weeks: int = 35) -> float:
    """
    Estimate EI maternity + parental benefit.
    Standard: 55% of avg insurable earnings, capped at max insurable.
    """
    max_ins = EI_MAX_INSURABLE.get(year, 65700)
    weekly_insurable = min(insurable_earnings, max_ins) / 52
    weekly_benefit = weekly_insurable * EI_BENEFIT_RATE
    return round(weekly_benefit * weeks, 2)


def margin_interest_deduction(loan_amount: float, rate_pct: float) -> float:
    """Annual margin interest — deductible against investment income under ITA s.20(1)(c)."""
    return round(loan_amount * rate_pct / 100, 2)
