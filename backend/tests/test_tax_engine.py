"""
CRA Tax Engine Tests
Validates that all formulas match Canada Revenue Agency rules.

References:
  Federal brackets: https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/canadian-income-tax-rates-individuals-current-previous-years.html
  Ontario brackets: https://www.ontario.ca/page/ontario-tax-credits-and-benefits
  TFSA limits:      https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/contributions.html
  RRSP limits:      https://www.canada.ca/en/revenue-agency/news/newsroom/tax-tips/tax-tips-2025/rrsp-contribution-limit.html
  Capital gains:    https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains.html
  FHSA:             https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/first-home-savings-account.html
"""
import pytest
from app.services.tax_engine import (
    calculate_annual_tax,
    tfsa_room_to_date,
    rrsp_room,
    ei_maternity_benefit,
    margin_interest_deduction,
    TFSA_LIMITS,
    RRSP_LIMITS,
    FHSA_ANNUAL_LIMIT,
    FHSA_LIFETIME_LIMIT,
)

TOLERANCE = 0.01  # $0.01 tolerance for floating point


# ─────────────────────────────────────────────────────────────────────
# TFSA Contribution Room (ITA s.146.2)
# ─────────────────────────────────────────────────────────────────────

class TestTFSARoom:
    def test_tfsa_room_resident_since_2009_through_2026(self):
        """Person resident since 2009 accumulates full historical room."""
        room = tfsa_room_to_date(2026, canada_resident_since_year=2009)
        # Hand-calculated from CRA annual limits:
        expected = (
            5000 +   # 2009
            5000 +   # 2010
            5000 +   # 2011
            5000 +   # 2012
            5500 +   # 2013
            5500 +   # 2014
            10000 +  # 2015
            5500 +   # 2016
            5500 +   # 2017
            5500 +   # 2018
            6000 +   # 2019
            6000 +   # 2020
            6000 +   # 2021
            6000 +   # 2022
            6500 +   # 2023
            7000 +   # 2024
            7000 +   # 2025
            7000     # 2026
        )
        assert room == expected  # Should be $109,000

    def test_tfsa_room_resident_since_2018_through_2026(self):
        """Person who moved to Canada in 2018 only gets room from 2018 onward."""
        room = tfsa_room_to_date(2026, canada_resident_since_year=2018)
        expected = (
            5500 +   # 2018
            6000 +   # 2019
            6000 +   # 2020
            6000 +   # 2021
            6000 +   # 2022
            6500 +   # 2023
            7000 +   # 2024
            7000 +   # 2025
            7000     # 2026
        )
        assert room == expected  # Should be $57,000

    def test_tfsa_room_does_not_predate_residency(self):
        """TFSA room before Canadian residency does not accumulate (ITA s.146.2(5))."""
        room_2018 = tfsa_room_to_date(2026, canada_resident_since_year=2018)
        room_2009 = tfsa_room_to_date(2026, canada_resident_since_year=2009)
        assert room_2018 < room_2009
        assert room_2018 == 57000
        assert room_2009 == 109000  # sum of all TFSA limits 2009–2026

    def test_tfsa_annual_2026_limit(self):
        """CRA confirmed 2026 TFSA annual limit."""
        assert TFSA_LIMITS[2026] == 7000

    def test_tfsa_annual_2023_limit(self):
        """2023 was the first year of $6,500 limit."""
        assert TFSA_LIMITS[2023] == 6500

    def test_tfsa_annual_2015_limit(self):
        """2015 had the special $10,000 limit (later reduced by new government)."""
        assert TFSA_LIMITS[2015] == 10000


# ─────────────────────────────────────────────────────────────────────
# RRSP Contribution Room (ITA s.146)
# ─────────────────────────────────────────────────────────────────────

class TestRRSPRoom:
    def test_rrsp_room_high_income_capped(self):
        """High earner: 18% of $300K = $54K, but capped at $32,490 for 2026."""
        room = rrsp_room(2026, prior_year_earned_income=300000)
        assert room == RRSP_LIMITS[2026]
        assert room == 32490

    def test_rrsp_room_moderate_income(self):
        """Income $180,000: 18% = $32,400 — just under the 2026 cap."""
        room = rrsp_room(2026, prior_year_earned_income=180000)
        assert abs(room - 32400) < TOLERANCE

    def test_rrsp_room_low_income(self):
        """Income $80,000: 18% = $14,400 — well below any cap."""
        room = rrsp_room(2026, prior_year_earned_income=80000)
        assert abs(room - 14400) < TOLERANCE

    def test_rrsp_room_formula_18pct(self):
        """Core rule: RRSP room = 18% of prior year earned income (ITA s.146(1))."""
        income = 120000
        room = rrsp_room(2026, prior_year_earned_income=income)
        assert abs(room - income * 0.18) < TOLERANCE

    def test_rrsp_limit_2026(self):
        assert RRSP_LIMITS[2026] == 32490

    def test_rrsp_limit_2025(self):
        assert RRSP_LIMITS[2025] == 32490


# ─────────────────────────────────────────────────────────────────────
# Federal Income Tax Brackets (ITA Part I)
# ─────────────────────────────────────────────────────────────────────

class TestFederalTax:
    def test_zero_income_zero_tax(self):
        result = calculate_annual_tax(year=2026, employment_income=0)
        assert result.federal_tax == 0
        assert result.total_tax == 0

    def test_income_below_basic_personal_no_tax(self):
        """Income under $15,705 basic personal amount → zero federal tax."""
        result = calculate_annual_tax(year=2026, employment_income=15000)
        assert result.federal_tax == 0

    def test_income_in_first_bracket_only(self):
        """$40,000 income: taxable = 40000 - 15705 = 24295 → 15% = $3,644.25"""
        result = calculate_annual_tax(year=2026, employment_income=40000)
        taxable = 40000 - 15705
        expected_fed = taxable * 0.15
        assert abs(result.federal_tax - expected_fed) < TOLERANCE

    def test_income_crosses_second_bracket(self):
        """$80,000 income crosses into the 20.5% federal bracket."""
        result = calculate_annual_tax(year=2026, employment_income=80000)
        # First bracket: 57375 @ 15% = $8,606.25
        # Second bracket: (80000 - 15705 - 57375) = 6920 @ 20.5% = $1,418.60
        taxable = 80000 - 15705
        first_bracket = min(taxable, 57375) * 0.15
        second_bracket = max(0, taxable - 57375) * 0.205
        expected = first_bracket + second_bracket
        assert abs(result.federal_tax - expected) < TOLERANCE

    def test_top_marginal_rate_federal(self):
        """Income $300K should hit top 33% federal bracket."""
        result = calculate_annual_tax(year=2026, employment_income=300000)
        assert result.marginal_federal == 33.0

    def test_marginal_rate_reported_correctly(self):
        """Marginal rate for $90K income should be 20.5% federal.
        $90K taxable − $15,705 BPA = $74,295 after-BPA income.
        First bracket tops at $57,375 → second bracket 20.5% applies.
        ($60K only yields $44,295 after BPA, still in the 15% first bracket.)
        """
        result = calculate_annual_tax(year=2026, employment_income=90000)
        assert result.marginal_federal == 20.5


# ─────────────────────────────────────────────────────────────────────
# Capital Gains (ITA s.38) — 50% Inclusion Rate
# ─────────────────────────────────────────────────────────────────────

class TestCapitalGains:
    def test_50pct_inclusion_rate(self):
        """Only 50% of capital gain is included in income (ITA s.38(a), 2026)."""
        result = calculate_annual_tax(year=2026, employment_income=0, capital_gains_realized=100000)
        assert result.breakdown["capital_gains_included_50pct"] == 50000

    def test_capital_gain_increases_taxable_income_by_half(self):
        """$50K gain → $25K taxable. Income with and without gain should differ by exactly $25K."""
        base = calculate_annual_tax(year=2026, employment_income=50000)
        with_gain = calculate_annual_tax(year=2026, employment_income=50000, capital_gains_realized=50000)
        assert abs(with_gain.taxable_income - base.taxable_income - 25000) < TOLERANCE

    def test_capital_loss_does_not_generate_refund(self):
        """Capital losses do not create negative tax — they carry forward."""
        result = calculate_annual_tax(year=2026, employment_income=0, capital_gains_realized=-50000)
        # Negative gains should be treated as 0 (carry forward, not refunded)
        assert result.total_tax >= 0

    def test_capital_gains_tax_portion(self):
        """capital_gains_tax field should represent only the tax on the gain portion."""
        result = calculate_annual_tax(
            year=2026,
            employment_income=80000,
            capital_gains_realized=100000,
        )
        assert result.capital_gains_tax >= 0
        assert result.capital_gains_tax <= result.total_tax


# ─────────────────────────────────────────────────────────────────────
# Eligible Dividend Tax Credits (ITA s.121)
# ─────────────────────────────────────────────────────────────────────

class TestDividendCredits:
    def test_eligible_dividend_grossup_38pct(self):
        """Eligible dividends are grossed up by 38% before inclusion in income."""
        result = calculate_annual_tax(year=2026, employment_income=0, eligible_dividends=10000)
        expected_grossup = 10000 * 1.38  # $13,800
        assert abs(result.breakdown["eligible_dividends_grossed_up"] - expected_grossup) < TOLERANCE

    def test_federal_dividend_tax_credit_15_02pct(self):
        """Federal eligible dividend tax credit = 15.02% of actual dividend (not grossed up)."""
        dividends = 10000
        result = calculate_annual_tax(year=2026, employment_income=0, eligible_dividends=dividends)
        expected_credit = dividends * 0.1502
        assert abs(result.breakdown["federal_dividend_credit"] - expected_credit) < TOLERANCE


# ─────────────────────────────────────────────────────────────────────
# RRSP Deduction Effect
# ─────────────────────────────────────────────────────────────────────

class TestRRSPDeduction:
    def test_rrsp_deduction_reduces_taxable_income(self):
        """RRSP contribution reduces taxable income dollar-for-dollar."""
        no_rrsp = calculate_annual_tax(year=2026, employment_income=100000)
        with_rrsp = calculate_annual_tax(year=2026, employment_income=100000, rrsp_deduction=20000)
        assert abs(no_rrsp.taxable_income - with_rrsp.taxable_income - 20000) < TOLERANCE

    def test_rrsp_deduction_reduces_tax_at_marginal_rate(self):
        """Tax saving from RRSP should be approximately: deduction × marginal rate."""
        income = 250000  # In top Ontario bracket ~53%
        deduction = 32490
        no_rrsp = calculate_annual_tax(year=2026, employment_income=income)
        with_rrsp = calculate_annual_tax(year=2026, employment_income=income, rrsp_deduction=deduction)
        tax_saving = no_rrsp.total_tax - with_rrsp.total_tax
        # Should be close to deduction × combined marginal rate
        approx_saving = deduction * (with_rrsp.combined_marginal / 100)
        # Allow 10% tolerance (bracket boundaries cause small differences)
        assert abs(tax_saving - approx_saving) / approx_saving < 0.10


# ─────────────────────────────────────────────────────────────────────
# EI Maternity Benefits
# ─────────────────────────────────────────────────────────────────────

class TestMaternityEI:
    def test_ei_benefit_rate_55pct(self):
        """Standard EI benefit = 55% of weekly insurable earnings."""
        annual_earnings = 65700  # Max insurable 2026
        benefit = ei_maternity_benefit(annual_earnings, year=2026, weeks=1)
        weekly_insurable = 65700 / 52
        expected = weekly_insurable * 0.55
        assert abs(benefit - expected) < TOLERANCE

    def test_ei_benefit_capped_at_max_insurable(self):
        """EI capped even if salary exceeds max insurable earnings."""
        low = ei_maternity_benefit(65700, 2026, 35)
        high = ei_maternity_benefit(200000, 2026, 35)
        assert abs(low - high) < TOLERANCE  # Same benefit at cap

    def test_ei_below_max_insurable(self):
        """Below max insurable, benefit = 55% of actual earnings (weekly rate)."""
        earnings = 52000  # Under the 2026 cap
        benefit = ei_maternity_benefit(earnings, 2026, 35)
        expected = (earnings / 52) * 0.55 * 35
        assert abs(benefit - expected) < TOLERANCE


# ─────────────────────────────────────────────────────────────────────
# Margin Interest Deduction (ITA s.20(1)(c))
# ─────────────────────────────────────────────────────────────────────

class TestMarginInterest:
    def test_margin_interest_formula(self):
        """Annual interest = loan × rate / 100."""
        interest = margin_interest_deduction(100000, 3.95)
        assert abs(interest - 3950.0) < TOLERANCE

    def test_margin_interest_deduction_reduces_tax(self):
        """Margin interest deduction reduces taxable income."""
        no_deduction = calculate_annual_tax(year=2026, employment_income=200000)
        with_deduction = calculate_annual_tax(year=2026, employment_income=200000, margin_interest_deduction=3950)
        assert with_deduction.total_tax < no_deduction.total_tax
        assert abs(no_deduction.taxable_income - with_deduction.taxable_income - 3950) < TOLERANCE


# ─────────────────────────────────────────────────────────────────────
# FHSA Constants (ITA s.146.6)
# ─────────────────────────────────────────────────────────────────────

class TestFHSA:
    def test_fhsa_annual_limit(self):
        assert FHSA_ANNUAL_LIMIT == 8000

    def test_fhsa_lifetime_limit(self):
        assert FHSA_LIFETIME_LIMIT == 40000


# ─────────────────────────────────────────────────────────────────────
# After-tax income sanity check
# ─────────────────────────────────────────────────────────────────────

class TestAfterTaxSanity:
    def test_after_tax_equals_gross_minus_total_tax(self):
        """after_tax_income must equal gross_income - total_tax (no rounding gaps > $1)."""
        result = calculate_annual_tax(year=2026, employment_income=150000, bonus=25000)
        assert abs(result.after_tax_income - (result.gross_income - result.total_tax)) < 1.0

    def test_average_rate_below_marginal_rate(self):
        """Average effective rate is always below the marginal rate (progressive system)."""
        result = calculate_annual_tax(year=2026, employment_income=200000)
        assert result.average_rate < result.combined_marginal

    def test_high_income_combined_marginal_rate(self):
        """Ontario top combined marginal rate should be approximately 53.53%."""
        result = calculate_annual_tax(year=2026, employment_income=300000)
        # 33% federal + 13.16% Ontario = 46.16% on salary
        # Combined marginal including surtaxes should be ~53%
        assert result.combined_marginal > 45  # At minimum the basic combined rate
        assert result.combined_marginal < 60  # Should not exceed 60%
