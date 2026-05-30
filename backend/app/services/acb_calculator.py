"""
Adjusted Cost Base (ACB) Calculator — CRA rules.
Handles buys, sells, reinvested distributions, return of capital, stock splits.
Superficial loss rule (30-day) detection is flagged but not auto-blocked.
"""

from dataclasses import dataclass
from typing import List, Optional
from datetime import datetime, timedelta


@dataclass
class ACBRecord:
    date: datetime
    transaction_type: str
    quantity: float
    price_per_share_cad: float
    fees_cad: float
    fx_rate: float
    total_cost_cad: float
    shares_after: float
    acb_per_share_after: float
    total_acb_after: float
    capital_gain_loss_cad: float
    superficial_loss_flag: bool
    notes: str


def calculate_acb_history(transactions: list) -> list[ACBRecord]:
    """
    Given a list of transaction dicts (sorted by date), compute running ACB.
    Returns full ACBRecord history.

    transaction dict keys:
      date, transaction_type, quantity, price_per_share_cad, fees_cad, fx_rate, notes
    """
    records = []
    current_shares = 0.0
    current_total_acb = 0.0

    for txn in sorted(transactions, key=lambda x: x["date"]):
        t_type = txn["transaction_type"].lower()
        qty = float(txn["quantity"])
        price = float(txn["price_per_share_cad"])
        fees = float(txn.get("fees_cad", 0))
        fx = float(txn.get("fx_rate", 1.0))
        gain_loss = 0.0
        superficial = False

        if t_type == "buy":
            cost = qty * price + fees
            current_total_acb += cost
            current_shares += qty
            total_cost = cost

        elif t_type == "sell":
            proceeds = qty * price - fees
            if current_shares > 0:
                acb_sold = (current_total_acb / current_shares) * qty
                gain_loss = proceeds - acb_sold
                current_total_acb -= acb_sold
                current_shares -= qty
                total_cost = acb_sold
                # Flag potential superficial loss (buy within 30 days)
                if gain_loss < 0:
                    superficial = True  # caller should verify 30-day window
            else:
                total_cost = 0.0

        elif t_type == "reinvest":
            # Reinvested distribution — increases ACB
            cost = qty * price
            current_total_acb += cost
            current_shares += qty
            total_cost = cost

        elif t_type == "return_of_capital":
            # ROC reduces ACB, does not add shares
            roc_total = qty  # qty here is the dollar amount of ROC
            current_total_acb = max(0, current_total_acb - roc_total)
            total_cost = -roc_total
            qty = 0

        elif t_type == "split":
            # Stock split — adjust shares, ACB per share recalculates, total ACB unchanged
            current_shares = qty  # qty = new total shares after split
            total_cost = 0.0

        else:
            total_cost = 0.0

        acb_per = current_total_acb / current_shares if current_shares > 0 else 0

        records.append(ACBRecord(
            date=txn["date"],
            transaction_type=t_type,
            quantity=qty,
            price_per_share_cad=price,
            fees_cad=fees,
            fx_rate=fx,
            total_cost_cad=round(total_cost, 4),
            shares_after=round(current_shares, 6),
            acb_per_share_after=round(acb_per, 6),
            total_acb_after=round(current_total_acb, 4),
            capital_gain_loss_cad=round(gain_loss, 4),
            superficial_loss_flag=superficial,
            notes=txn.get("notes", "")
        ))

    return records


def current_acb(transactions: list) -> dict:
    """Return current ACB summary for a holding."""
    history = calculate_acb_history(transactions)
    if not history:
        return {"shares": 0, "acb_per_share": 0, "total_acb": 0, "realized_gains": 0}
    last = history[-1]
    realized = sum(r.capital_gain_loss_cad for r in history)
    return {
        "shares": last.shares_after,
        "acb_per_share": last.acb_per_share_after,
        "total_acb": last.total_acb_after,
        "realized_gains": round(realized, 2),
    }


def unrealized_gain(current_shares: float, current_price_cad: float, acb_per_share: float) -> float:
    """Calculate unrealized gain/loss."""
    return round((current_price_cad - acb_per_share) * current_shares, 2)


def capital_gain_on_sale(
    shares_to_sell: float,
    sale_price_cad: float,
    acb_per_share: float,
    fees_cad: float = 0,
) -> dict:
    """
    Project capital gain/loss from a hypothetical sale.
    Returns gain, tax at 50% inclusion, and net proceeds.
    """
    proceeds = shares_to_sell * sale_price_cad - fees_cad
    acb_sold = shares_to_sell * acb_per_share
    gain = proceeds - acb_sold
    included = gain * 0.50  # 50% inclusion
    return {
        "proceeds": round(proceeds, 2),
        "acb_sold": round(acb_sold, 2),
        "capital_gain": round(gain, 2),
        "taxable_portion_50pct": round(included, 2),
        "is_loss": gain < 0,
    }


def loss_harvest_analysis(
    symbol: str,
    shares: float,
    current_price_cad: float,
    acb_per_share: float,
    marginal_rate: float,
    other_gains_ytd: float = 0,
) -> dict:
    """
    Analyze a capital loss harvesting opportunity.
    Calculates tax saved by realizing the loss against existing gains.
    """
    unrealized = unrealized_gain(shares, current_price_cad, acb_per_share)
    if unrealized >= 0:
        return {"symbol": symbol, "action": "no_loss", "unrealized_gain": unrealized}

    loss = abs(unrealized)
    usable_against_gains = min(loss, other_gains_ytd)
    loss_carried = max(0, loss - usable_against_gains)
    tax_saved_now = usable_against_gains * 0.50 * (marginal_rate / 100)
    tax_saved_carryforward = loss_carried * 0.50 * (marginal_rate / 100)

    return {
        "symbol": symbol,
        "unrealized_loss": round(-unrealized, 2),
        "usable_against_ytd_gains": round(usable_against_gains, 2),
        "loss_carryforward": round(loss_carried, 2),
        "estimated_tax_saved_now": round(tax_saved_now, 2),
        "estimated_tax_saved_carryforward": round(tax_saved_carryforward, 2),
        "superficial_loss_warning": "Do NOT repurchase identical security within 30 days before or after sale (ITA s.54 superficial loss rule).",
        "action": "consider_harvesting",
    }
