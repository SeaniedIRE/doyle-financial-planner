"""
ACB Calculator Tests — CRA adjusted cost base rules.

References:
  ACB rules:         https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains/calculating-reporting-your-capital-gains-losses/adjusted-cost-base.html
  Superficial loss:  https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains/calculating-reporting-your-capital-gains-losses/superficial-losses.html
  Return of capital: https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains/calculating-reporting-your-capital-gains-losses/return-of-capital.html
"""
import pytest
from datetime import datetime
from app.services.acb_calculator import (
    calculate_acb_history,
    current_acb,
    unrealized_gain,
    capital_gain_on_sale,
    loss_harvest_analysis,
)

TOLERANCE = 0.01


# ─────────────────────────────────────────────────────────────────────
# Basic buy/sell ACB math
# ─────────────────────────────────────────────────────────────────────

class TestBasicACB:
    def _txn(self, t_type, qty, price, fees=0, date=None, notes=""):
        return {
            "date": date or datetime(2024, 1, 1),
            "transaction_type": t_type,
            "quantity": qty,
            "price_per_share_cad": price,
            "fees_cad": fees,
            "fx_rate": 1.0,
            "notes": notes,
        }

    def test_single_buy_acb(self):
        """Single buy: ACB = qty × price + fees."""
        txns = [self._txn("buy", 100, 50.00, fees=9.99)]
        history = calculate_acb_history(txns)
        assert len(history) == 1
        assert abs(history[0].total_acb_after - (100 * 50.00 + 9.99)) < TOLERANCE
        assert abs(history[0].acb_per_share_after - (5009.99 / 100)) < TOLERANCE
        assert history[0].shares_after == 100

    def test_two_buys_weighted_average_acb(self):
        """Two buys at different prices → weighted average ACB per share."""
        txns = [
            self._txn("buy", 100, 50.00, date=datetime(2024, 1, 1)),
            self._txn("buy", 100, 60.00, date=datetime(2024, 2, 1)),
        ]
        history = calculate_acb_history(txns)
        last = history[-1]
        expected_total_acb = 100 * 50 + 100 * 60  # 5000 + 6000 = 11000
        expected_per_share = expected_total_acb / 200
        assert abs(last.total_acb_after - expected_total_acb) < TOLERANCE
        assert abs(last.acb_per_share_after - expected_per_share) < TOLERANCE
        assert last.shares_after == 200

    def test_sell_capital_gain(self):
        """Buy 100 @ $50, sell 50 @ $80 → gain = (80-50)×50 = $1,500."""
        txns = [
            self._txn("buy", 100, 50.00, date=datetime(2024, 1, 1)),
            self._txn("sell", 50, 80.00, date=datetime(2024, 6, 1)),
        ]
        history = calculate_acb_history(txns)
        sell = history[1]
        expected_gain = 50 * 80 - 50 * 50  # proceeds - acb_sold
        assert abs(sell.capital_gain_loss_cad - expected_gain) < TOLERANCE
        assert sell.capital_gain_loss_cad > 0

    def test_sell_capital_loss(self):
        """Buy 100 @ $50, sell 50 @ $30 → loss = (30-50)×50 = -$1,000."""
        txns = [
            self._txn("buy", 100, 50.00, date=datetime(2024, 1, 1)),
            self._txn("sell", 50, 30.00, date=datetime(2024, 6, 1)),
        ]
        history = calculate_acb_history(txns)
        sell = history[1]
        assert sell.capital_gain_loss_cad < 0
        assert abs(sell.capital_gain_loss_cad - (-1000)) < TOLERANCE

    def test_sell_reduces_acb_proportionally(self):
        """Selling half the shares removes exactly half the total ACB."""
        txns = [
            self._txn("buy", 200, 50.00, date=datetime(2024, 1, 1)),
            self._txn("sell", 100, 60.00, date=datetime(2024, 6, 1)),
        ]
        history = calculate_acb_history(txns)
        buy_acb = history[0].total_acb_after  # 200 × 50 = 10000
        sell_acb = history[1].total_acb_after  # should be 5000
        assert abs(sell_acb - buy_acb / 2) < TOLERANCE
        assert history[1].shares_after == 100

    def test_buy_sell_buy_acb(self):
        """Buy 100 @ $50, sell 50 @ $70, buy 80 @ $60 → correct running ACB."""
        txns = [
            self._txn("buy", 100, 50.00, date=datetime(2024, 1, 1)),
            self._txn("sell", 50, 70.00, date=datetime(2024, 3, 1)),
            self._txn("buy", 80, 60.00, date=datetime(2024, 6, 1)),
        ]
        history = calculate_acb_history(txns)
        # After sell: 50 shares at $50 ACB each = $2,500
        # After 2nd buy: (50 × $50 + 80 × $60) / 130 = ($2,500 + $4,800) / 130 = $56.15...
        last = history[-1]
        remaining_acb = 50 * 50.0 + 80 * 60.0
        expected_per_share = remaining_acb / 130
        assert abs(last.total_acb_after - remaining_acb) < TOLERANCE
        assert abs(last.acb_per_share_after - expected_per_share) < TOLERANCE
        assert last.shares_after == 130

    def test_fees_included_in_acb_on_buy(self):
        """Commission on a buy increases ACB (ITA s.54 adjusted cost base definition)."""
        txns = [self._txn("buy", 100, 50.00, fees=20.00)]
        history = calculate_acb_history(txns)
        assert abs(history[0].total_acb_after - 5020.00) < TOLERANCE

    def test_fees_deducted_from_proceeds_on_sell(self):
        """Commission on a sell reduces proceeds (not ACB)."""
        txns = [
            self._txn("buy", 100, 50.00, date=datetime(2024, 1, 1)),
            self._txn("sell", 100, 60.00, fees=10.00, date=datetime(2024, 6, 1)),
        ]
        history = calculate_acb_history(txns)
        sell = history[1]
        expected_proceeds = 100 * 60 - 10  # 5990
        expected_acb_sold = 100 * 50  # 5000
        expected_gain = expected_proceeds - expected_acb_sold  # 990
        assert abs(sell.capital_gain_loss_cad - expected_gain) < TOLERANCE


# ─────────────────────────────────────────────────────────────────────
# Reinvested distributions — add to ACB (ITA s.53(1)(b))
# ─────────────────────────────────────────────────────────────────────

class TestReinvestedDistributions:
    def test_reinvest_increases_acb(self):
        """Reinvested distribution increases ACB without a taxable event at reinvest time."""
        txns = [
            {"date": datetime(2024, 1, 1), "transaction_type": "buy", "quantity": 100, "price_per_share_cad": 50, "fees_cad": 0, "fx_rate": 1.0, "notes": ""},
            {"date": datetime(2024, 6, 1), "transaction_type": "reinvest", "quantity": 2, "price_per_share_cad": 51, "fees_cad": 0, "fx_rate": 1.0, "notes": ""},
        ]
        history = calculate_acb_history(txns)
        acb_before = history[0].total_acb_after  # 5000
        acb_after = history[1].total_acb_after  # 5000 + (2 × 51) = 5102
        assert acb_after > acb_before
        assert abs(acb_after - (5000 + 2 * 51)) < TOLERANCE
        assert history[1].shares_after == 102


# ─────────────────────────────────────────────────────────────────────
# Return of Capital — reduces ACB (ITA s.53(2)(b))
# ─────────────────────────────────────────────────────────────────────

class TestReturnOfCapital:
    def test_roc_reduces_acb(self):
        """Return of capital decreases ACB by the ROC amount."""
        txns = [
            {"date": datetime(2024, 1, 1), "transaction_type": "buy", "quantity": 100, "price_per_share_cad": 50, "fees_cad": 0, "fx_rate": 1.0, "notes": ""},
            {"date": datetime(2024, 6, 1), "transaction_type": "return_of_capital", "quantity": 500, "price_per_share_cad": 0, "fees_cad": 0, "fx_rate": 1.0, "notes": "$500 ROC"},
        ]
        history = calculate_acb_history(txns)
        expected_acb = 5000 - 500  # 4500
        assert abs(history[1].total_acb_after - expected_acb) < TOLERANCE
        assert history[1].shares_after == 100  # shares unchanged

    def test_roc_cannot_reduce_acb_below_zero(self):
        """ACB cannot go below $0 from ROC (ITA s.53(2)(b) — excess ROC is a capital gain)."""
        txns = [
            {"date": datetime(2024, 1, 1), "transaction_type": "buy", "quantity": 100, "price_per_share_cad": 5, "fees_cad": 0, "fx_rate": 1.0, "notes": ""},
            {"date": datetime(2024, 6, 1), "transaction_type": "return_of_capital", "quantity": 10000, "price_per_share_cad": 0, "fees_cad": 0, "fx_rate": 1.0, "notes": "Massive ROC"},
        ]
        history = calculate_acb_history(txns)
        assert history[1].total_acb_after >= 0


# ─────────────────────────────────────────────────────────────────────
# Stock split — adjusts shares, ACB per share, total ACB unchanged
# ─────────────────────────────────────────────────────────────────────

class TestStockSplit:
    def test_split_adjusts_shares_not_total_acb(self):
        """2-for-1 split doubles shares; total ACB is unchanged; per-share ACB halves."""
        txns = [
            {"date": datetime(2024, 1, 1), "transaction_type": "buy", "quantity": 100, "price_per_share_cad": 100, "fees_cad": 0, "fx_rate": 1.0, "notes": ""},
            {"date": datetime(2024, 6, 1), "transaction_type": "split", "quantity": 200, "price_per_share_cad": 50, "fees_cad": 0, "fx_rate": 1.0, "notes": "2:1 split"},
        ]
        history = calculate_acb_history(txns)
        assert history[1].shares_after == 200
        assert abs(history[1].total_acb_after - 10000) < TOLERANCE
        assert abs(history[1].acb_per_share_after - 50) < TOLERANCE


# ─────────────────────────────────────────────────────────────────────
# Superficial loss flag (ITA s.54)
# ─────────────────────────────────────────────────────────────────────

class TestSuperficialLoss:
    def test_loss_sale_is_flagged(self):
        """Any sell at a loss should flag superficial_loss_flag=True as a warning."""
        txns = [
            {"date": datetime(2024, 1, 1), "transaction_type": "buy", "quantity": 100, "price_per_share_cad": 50, "fees_cad": 0, "fx_rate": 1.0, "notes": ""},
            {"date": datetime(2024, 2, 1), "transaction_type": "sell", "quantity": 100, "price_per_share_cad": 30, "fees_cad": 0, "fx_rate": 1.0, "notes": ""},
        ]
        history = calculate_acb_history(txns)
        assert history[1].superficial_loss_flag is True

    def test_gain_sale_is_not_flagged(self):
        """Sell at a gain should NOT set superficial_loss_flag."""
        txns = [
            {"date": datetime(2024, 1, 1), "transaction_type": "buy", "quantity": 100, "price_per_share_cad": 50, "fees_cad": 0, "fx_rate": 1.0, "notes": ""},
            {"date": datetime(2024, 2, 1), "transaction_type": "sell", "quantity": 100, "price_per_share_cad": 70, "fees_cad": 0, "fx_rate": 1.0, "notes": ""},
        ]
        history = calculate_acb_history(txns)
        assert history[1].superficial_loss_flag is False


# ─────────────────────────────────────────────────────────────────────
# Unrealized gain helper
# ─────────────────────────────────────────────────────────────────────

class TestUnrealizedGain:
    def test_gain_positive(self):
        assert abs(unrealized_gain(100, 70.00, 50.00) - 2000.00) < TOLERANCE

    def test_loss_negative(self):
        assert abs(unrealized_gain(100, 30.00, 50.00) - (-2000.00)) < TOLERANCE

    def test_breakeven_zero(self):
        assert abs(unrealized_gain(100, 50.00, 50.00)) < TOLERANCE


# ─────────────────────────────────────────────────────────────────────
# Capital gain on sale projection
# ─────────────────────────────────────────────────────────────────────

class TestCapitalGainOnSale:
    def test_simple_gain(self):
        result = capital_gain_on_sale(shares_to_sell=100, sale_price_cad=70, acb_per_share=50)
        assert abs(result["capital_gain"] - 2000) < TOLERANCE
        assert abs(result["taxable_portion_50pct"] - 1000) < TOLERANCE
        assert result["is_loss"] is False

    def test_simple_loss(self):
        result = capital_gain_on_sale(shares_to_sell=100, sale_price_cad=30, acb_per_share=50)
        assert result["capital_gain"] < 0
        assert result["is_loss"] is True

    def test_fees_reduce_proceeds(self):
        result = capital_gain_on_sale(shares_to_sell=100, sale_price_cad=70, acb_per_share=50, fees_cad=50)
        expected_gain = (100 * 70 - 50) - (100 * 50)  # 6950 - 5000 = 1950
        assert abs(result["capital_gain"] - expected_gain) < TOLERANCE

    def test_50pct_inclusion(self):
        """Taxable portion is always exactly 50% of the capital gain (ITA s.38(a))."""
        result = capital_gain_on_sale(shares_to_sell=200, sale_price_cad=100, acb_per_share=60)
        assert abs(result["taxable_portion_50pct"] - result["capital_gain"] * 0.50) < TOLERANCE


# ─────────────────────────────────────────────────────────────────────
# Loss harvest analysis
# ─────────────────────────────────────────────────────────────────────

class TestLossHarvestAnalysis:
    def test_no_loss_returns_no_action(self):
        """If position is at a gain, no harvesting recommendation."""
        result = loss_harvest_analysis("VFV", 100, 80.00, 50.00, 50.0, 0)
        assert result["action"] == "no_loss"

    def test_loss_with_gains_to_offset(self):
        """Loss against existing gains → immediate tax saving calculated."""
        result = loss_harvest_analysis("PSNY", 100, 20.00, 50.00, 50.0, other_gains_ytd=5000)
        # Unrealized loss = (20 - 50) × 100 = -3000
        # All 3000 usable against 5000 of existing gains
        assert result["action"] == "consider_harvesting"
        assert abs(result["unrealized_loss"] - 3000) < TOLERANCE
        assert abs(result["usable_against_ytd_gains"] - 3000) < TOLERANCE
        assert result["loss_carryforward"] == 0
        # Tax saved = 3000 × 50% × (50% marginal) = 750
        assert abs(result["estimated_tax_saved_now"] - 750) < TOLERANCE

    def test_loss_larger_than_gains_creates_carryforward(self):
        """Loss exceeding YTD gains creates a capital loss carryforward."""
        result = loss_harvest_analysis("PSNY", 100, 10.00, 50.00, 50.0, other_gains_ytd=1000)
        # Unrealized loss = 4000, only 1000 usable now, 3000 carries forward
        assert abs(result["unrealized_loss"] - 4000) < TOLERANCE
        assert abs(result["usable_against_ytd_gains"] - 1000) < TOLERANCE
        assert abs(result["loss_carryforward"] - 3000) < TOLERANCE

    def test_superficial_loss_warning_present(self):
        """Loss harvest result always includes the superficial loss warning."""
        result = loss_harvest_analysis("XYZ", 100, 30.00, 50.00, 53.0, 0)
        assert "superficial_loss_warning" in result
        assert "30" in result["superficial_loss_warning"]

    def test_current_acb_summary(self):
        """current_acb() returns correct summary after multiple transactions."""
        txns = [
            {"date": datetime(2024, 1, 1), "transaction_type": "buy", "quantity": 100, "price_per_share_cad": 50, "fees_cad": 0, "fx_rate": 1.0, "notes": ""},
            {"date": datetime(2024, 6, 1), "transaction_type": "sell", "quantity": 30, "price_per_share_cad": 70, "fees_cad": 0, "fx_rate": 1.0, "notes": ""},
        ]
        summary = current_acb(txns)
        assert summary["shares"] == 70
        assert abs(summary["acb_per_share"] - 50.0) < TOLERANCE
        assert abs(summary["total_acb"] - 3500.0) < TOLERANCE
        # Realized gain from the sell: (70 - 50) × 30 = 600
        assert abs(summary["realized_gains"] - 600) < TOLERANCE
