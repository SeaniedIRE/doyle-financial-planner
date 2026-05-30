"""
Portfolio Forecast Engine — compound growth projections with Canadian account rules.
Three scenarios: conservative (5%), moderate (7%), optimistic (10%).
Handles TFSA/RRSP/FHSA room, maternity leave income drops, house purchase cash outflow.
"""

from dataclasses import dataclass, field
from typing import Optional
from .tax_engine import (
    calculate_annual_tax, rrsp_room, tfsa_room_to_date,
    TFSA_LIMITS, RRSP_LIMITS, FHSA_ANNUAL_LIMIT, ei_maternity_benefit
)


GROWTH_RATES = {
    "conservative": 0.05,
    "moderate": 0.07,
    "optimistic": 0.10,
}

# Approximate 10-year trailing returns for the main ETFs in the portfolio
LAST_TREND_RATES = {
    "VFV": 0.148,   # S&P 500 ~14.8% 10yr CAD
    "XEQT": 0.098,  # Global equity ~9.8%
    "HULC": 0.130,
    "HXDM": 0.075,
    "HXEM": 0.040,
    "HXQ":  0.180,
    "HXT":  0.085,
    "HEWB": 0.095,
    "default": 0.085,
}


@dataclass
class YearSnapshot:
    year: int
    sean_net_worth: dict  # {conservative, moderate, optimistic}
    saudya_net_worth: dict
    combined_net_worth: dict
    sean_income_after_tax: float
    saudya_income_after_tax: float
    sean_tax: float
    saudya_tax: float
    tfsa_sean_value: dict
    tfsa_saudya_value: dict
    rrsp_sean_value: dict
    rrsp_saudya_value: dict
    fhsa_sean_value: dict
    fhsa_saudya_value: dict
    margin_sean_value: dict
    margin_saudya_value: dict
    joint_value: dict
    events: list[str] = field(default_factory=list)


def grow(value: float, rate: float, years: int = 1) -> float:
    return value * ((1 + rate) ** years)


def project_portfolio(
    start_year: int,
    end_year: int,
    # Current account values (CAD)
    sean_tfsa: float,
    sean_rrsp: float,
    sean_fhsa: float,
    sean_margin: float,
    sean_cash: float,
    saudya_tfsa: float,
    saudya_rrsp: float,
    saudya_fhsa: float,
    saudya_lira: float,
    saudya_margin: float,
    saudya_cash: float,
    joint_emergency: float,
    # Income
    sean_base: float,
    sean_bonus: float,
    sean_other_bonus: float,
    saudya_base: float,
    saudya_bonus: float,
    # Margin
    sean_margin_loan: float = 100000,
    saudya_margin_loan: float = 100000,
    margin_rate: float = 3.95,
    # Life events
    mat_leave_1_year: int = 2027,
    mat_leave_2_year: int = 2028,
    house_purchase_year: int = 2030,
    house_down_payment: float = 200000,
    fhsa_sean_room: float = 8000,
    fhsa_saudya_room: float = 8000,
    # TFSA residency
    sean_canada_since: int = 2018,
    saudya_canada_since: int = 2009,
    # Annual salary growth rate
    salary_growth_rate: float = 0.04,
    province: str = "ON",
) -> list[YearSnapshot]:
    """Project portfolio growth year by year."""
    snapshots = []

    # Mutable balances per scenario
    scenarios = ["conservative", "moderate", "optimistic"]

    def init_bal(val):
        return {s: val for s in scenarios}

    sean_tfsa_bal = init_bal(sean_tfsa)
    sean_rrsp_bal = init_bal(sean_rrsp)
    sean_fhsa_bal = init_bal(sean_fhsa)
    sean_margin_bal = init_bal(sean_margin)
    sean_cash_bal = init_bal(sean_cash)
    saudya_tfsa_bal = init_bal(saudya_tfsa)
    saudya_rrsp_bal = init_bal(saudya_rrsp)
    saudya_fhsa_bal = init_bal(saudya_fhsa)
    saudya_lira_bal = init_bal(saudya_lira)
    saudya_margin_bal = init_bal(saudya_margin)
    saudya_cash_bal = init_bal(saudya_cash)
    joint_bal = init_bal(joint_emergency)

    sean_inc = sean_base
    sean_bon = sean_bonus + sean_other_bonus
    saudya_inc = saudya_base
    saudya_bon = saudya_bonus

    fhsa_sean_remaining = fhsa_sean_room
    fhsa_saudya_remaining = fhsa_saudya_room
    fhsa_sean_contributed_total = 40000 - fhsa_sean_room
    fhsa_saudya_contributed_total = 40000 - fhsa_saudya_room

    house_purchased = False

    for year in range(start_year, end_year + 1):
        events = []
        years_since_start = year - start_year

        # Salary growth
        if years_since_start > 0:
            sean_inc *= (1 + salary_growth_rate)
            saudya_inc *= (1 + salary_growth_rate)
            sean_bon *= (1 + salary_growth_rate)
            saudya_bon *= (1 + salary_growth_rate)

        # Maternity leave adjustments
        is_mat1 = year == mat_leave_1_year
        is_mat2 = year == mat_leave_2_year
        saudya_effective_inc = saudya_inc
        saudya_effective_bon = saudya_bon
        saudya_mat_ei = 0.0

        if is_mat1 or is_mat2:
            events.append(f"Saudya maternity leave {year}")
            saudya_mat_ei = ei_maternity_benefit(saudya_inc, year, weeks=35)
            saudya_effective_inc = saudya_inc * 0.25  # partial year employment
            saudya_effective_bon = 0

        # RRSP contributions (use RRSP room, assume maxed)
        sean_rrsp_contrib = min(rrsp_room(year, sean_inc), RRSP_LIMITS.get(year, 32490))
        saudya_rrsp_contrib = min(rrsp_room(year, saudya_effective_inc), RRSP_LIMITS.get(year, 31560))
        if is_mat1 or is_mat2:
            saudya_rrsp_contrib = min(saudya_rrsp_contrib, 10000)  # reduced on mat leave

        # FHSA contributions
        sean_fhsa_contrib = 0.0
        saudya_fhsa_contrib = 0.0
        if not house_purchased and year <= 2027:
            if fhsa_sean_remaining > 0:
                sean_fhsa_contrib = min(fhsa_sean_remaining, FHSA_ANNUAL_LIMIT)
                fhsa_sean_remaining = max(0, fhsa_sean_remaining - sean_fhsa_contrib)
            if fhsa_saudya_remaining > 0:
                saudya_fhsa_contrib = min(fhsa_saudya_remaining, FHSA_ANNUAL_LIMIT)
                fhsa_saudya_remaining = max(0, fhsa_saudya_remaining - saudya_fhsa_contrib)

        # TFSA contributions (assume maximized each year)
        tfsa_annual = TFSA_LIMITS.get(year, 7000)
        sean_tfsa_contrib = tfsa_annual
        saudya_tfsa_contrib = tfsa_annual if not (is_mat1 or is_mat2) else tfsa_annual * 0.5

        # Margin interest deduction
        sean_margin_int = sean_margin_loan * margin_rate / 100
        saudya_margin_int = saudya_margin_loan * margin_rate / 100

        # Tax calculations
        sean_tax_res = calculate_annual_tax(
            year=year,
            employment_income=sean_inc,
            bonus=sean_bon,
            rrsp_deduction=sean_rrsp_contrib,
            margin_interest_deduction=sean_margin_int,
            province=province,
        )
        saudya_tax_res = calculate_annual_tax(
            year=year,
            employment_income=saudya_effective_inc,
            bonus=saudya_effective_bon,
            rrsp_deduction=saudya_rrsp_contrib,
            margin_interest_deduction=saudya_margin_int,
            province=province,
            is_maternity_leave=(is_mat1 or is_mat2),
            maternity_ei_income=saudya_mat_ei,
        )

        # House purchase
        if year == house_purchase_year and not house_purchased:
            house_purchased = True
            events.append(f"House purchase — FHSA withdrawn, down payment ~${house_down_payment:,.0f}")
            # FHSA balance goes to zero (tax-free withdrawal for first home)
            for s in scenarios:
                sean_fhsa_bal[s] = 0
                saudya_fhsa_bal[s] = 0
                # Assume down payment comes from savings (joint + cash accounts partially)
                total_avail = joint_bal[s] + sean_cash_bal[s] + saudya_cash_bal[s]
                if total_avail >= house_down_payment:
                    shortfall = house_down_payment
                    joint_draw = min(joint_bal[s], shortfall)
                    joint_bal[s] -= joint_draw
                    shortfall -= joint_draw
                    sean_draw = min(sean_cash_bal[s], shortfall / 2)
                    saudya_draw = min(saudya_cash_bal[s], shortfall / 2)
                    sean_cash_bal[s] -= sean_draw
                    saudya_cash_bal[s] -= saudya_draw

        # Grow all balances and add contributions
        for s in scenarios:
            r = GROWTH_RATES[s]
            # Registered accounts — grow + add contributions
            sean_tfsa_bal[s] = grow(sean_tfsa_bal[s], r) + sean_tfsa_contrib
            sean_rrsp_bal[s] = grow(sean_rrsp_bal[s], r) + sean_rrsp_contrib
            sean_fhsa_bal[s] = grow(sean_fhsa_bal[s], r) + sean_fhsa_contrib
            saudya_tfsa_bal[s] = grow(saudya_tfsa_bal[s], r) + saudya_tfsa_contrib
            saudya_rrsp_bal[s] = grow(saudya_rrsp_bal[s], r) + saudya_rrsp_contrib
            saudya_fhsa_bal[s] = grow(saudya_fhsa_bal[s], r) + saudya_fhsa_contrib
            saudya_lira_bal[s] = grow(saudya_lira_bal[s], r)  # LIRA: no new contributions, locked
            # Non-registered — grow; net of margin interest cost
            sean_margin_bal[s] = grow(sean_margin_bal[s], r) - sean_margin_int + (sean_margin_loan * r)
            saudya_margin_bal[s] = grow(saudya_margin_bal[s], r) - saudya_margin_int + (saudya_margin_loan * r)
            # Cash accounts — add investable surplus
            sean_surplus = max(0, sean_tax_res.after_tax_income - 60000)  # ~$60K living expenses
            saudya_surplus = max(0, saudya_tax_res.after_tax_income - 45000)
            sean_cash_bal[s] = grow(sean_cash_bal[s], r) + sean_surplus * 0.3
            saudya_cash_bal[s] = grow(saudya_cash_bal[s], r) + saudya_surplus * 0.3
            joint_bal[s] = grow(joint_bal[s], r)

        def net_worth(s):
            return (
                sean_tfsa_bal[s] + sean_rrsp_bal[s] + sean_fhsa_bal[s] +
                sean_margin_bal[s] - sean_margin_loan +
                sean_cash_bal[s] +
                saudya_tfsa_bal[s] + saudya_rrsp_bal[s] + saudya_fhsa_bal[s] +
                saudya_lira_bal[s] + saudya_margin_bal[s] - saudya_margin_loan +
                saudya_cash_bal[s] + joint_bal[s]
            )

        snap = YearSnapshot(
            year=year,
            sean_net_worth={s: round(
                sean_tfsa_bal[s] + sean_rrsp_bal[s] + sean_fhsa_bal[s] +
                sean_margin_bal[s] - sean_margin_loan + sean_cash_bal[s], 2
            ) for s in scenarios},
            saudya_net_worth={s: round(
                saudya_tfsa_bal[s] + saudya_rrsp_bal[s] + saudya_fhsa_bal[s] +
                saudya_lira_bal[s] + saudya_margin_bal[s] - saudya_margin_loan +
                saudya_cash_bal[s], 2
            ) for s in scenarios},
            combined_net_worth={s: round(net_worth(s) + joint_bal[s], 2) for s in scenarios},
            sean_income_after_tax=sean_tax_res.after_tax_income,
            saudya_income_after_tax=saudya_tax_res.after_tax_income,
            sean_tax=sean_tax_res.total_tax,
            saudya_tax=saudya_tax_res.total_tax,
            tfsa_sean_value={s: round(sean_tfsa_bal[s], 2) for s in scenarios},
            tfsa_saudya_value={s: round(saudya_tfsa_bal[s], 2) for s in scenarios},
            rrsp_sean_value={s: round(sean_rrsp_bal[s], 2) for s in scenarios},
            rrsp_saudya_value={s: round(saudya_rrsp_bal[s], 2) for s in scenarios},
            fhsa_sean_value={s: round(sean_fhsa_bal[s], 2) for s in scenarios},
            fhsa_saudya_value={s: round(saudya_fhsa_bal[s], 2) for s in scenarios},
            margin_sean_value={s: round(sean_margin_bal[s], 2) for s in scenarios},
            margin_saudya_value={s: round(saudya_margin_bal[s], 2) for s in scenarios},
            joint_value={s: round(joint_bal[s], 2) for s in scenarios},
            events=events,
        )
        snapshots.append(snap)

    return snapshots
