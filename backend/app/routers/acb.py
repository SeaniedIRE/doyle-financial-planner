from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..database import get_db
from ..models.acb import ACBTransaction
from ..models.account import Holding
from ..services.acb_calculator import calculate_acb_history, current_acb, loss_harvest_analysis

router = APIRouter(prefix="/api/acb", tags=["acb"])


class TransactionCreate(BaseModel):
    holding_id: int
    transaction_date: str  # ISO date string
    transaction_type: str
    quantity: float
    price_per_share_cad: float
    fees_cad: float = 0.0
    fx_rate: float = 1.0
    notes: str = ""


@router.get("/{holding_id}/history")
def get_acb_history(holding_id: int, db: Session = Depends(get_db)):
    txns = db.query(ACBTransaction).filter(
        ACBTransaction.holding_id == holding_id
    ).order_by(ACBTransaction.transaction_date).all()

    txn_dicts = [
        {
            "date": t.transaction_date,
            "transaction_type": t.transaction_type,
            "quantity": t.quantity,
            "price_per_share_cad": t.price_per_share_cad,
            "fees_cad": t.fees_cad,
            "fx_rate": t.fx_rate,
            "notes": t.notes,
        }
        for t in txns
    ]
    history = calculate_acb_history(txn_dicts)
    return [
        {
            "date": r.date.isoformat() if hasattr(r.date, "isoformat") else str(r.date),
            "transaction_type": r.transaction_type,
            "quantity": r.quantity,
            "price_per_share_cad": r.price_per_share_cad,
            "fees_cad": r.fees_cad,
            "total_cost_cad": r.total_cost_cad,
            "shares_after": r.shares_after,
            "acb_per_share_after": r.acb_per_share_after,
            "total_acb_after": r.total_acb_after,
            "capital_gain_loss_cad": r.capital_gain_loss_cad,
            "superficial_loss_flag": r.superficial_loss_flag,
            "notes": r.notes,
        }
        for r in history
    ]


@router.get("/{holding_id}/summary")
def get_acb_summary(holding_id: int, db: Session = Depends(get_db)):
    txns = db.query(ACBTransaction).filter(
        ACBTransaction.holding_id == holding_id
    ).order_by(ACBTransaction.transaction_date).all()
    txn_dicts = [
        {
            "date": t.transaction_date,
            "transaction_type": t.transaction_type,
            "quantity": t.quantity,
            "price_per_share_cad": t.price_per_share_cad,
            "fees_cad": t.fees_cad,
            "fx_rate": t.fx_rate,
            "notes": t.notes,
        }
        for t in txns
    ]
    return current_acb(txn_dicts)


@router.post("/transaction")
def add_transaction(data: TransactionCreate, db: Session = Depends(get_db)):
    h = db.query(Holding).filter(Holding.id == data.holding_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Holding not found")
    total_cost = data.quantity * data.price_per_share_cad + data.fees_cad
    txn = ACBTransaction(
        holding_id=data.holding_id,
        transaction_date=datetime.fromisoformat(data.transaction_date),
        transaction_type=data.transaction_type,
        quantity=data.quantity,
        price_per_share_cad=data.price_per_share_cad,
        fees_cad=data.fees_cad,
        fx_rate=data.fx_rate,
        total_cost_cad=total_cost,
        notes=data.notes,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return {"id": txn.id, "message": "Transaction recorded"}


@router.delete("/transaction/{txn_id}")
def delete_transaction(txn_id: int, db: Session = Depends(get_db)):
    txn = db.query(ACBTransaction).filter(ACBTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(txn)
    db.commit()
    return {"message": "Deleted"}


@router.get("/loss-harvest/analysis")
def loss_harvest_all(marginal_rate: float = 53.0, ytd_gains: float = 0.0, db: Session = Depends(get_db)):
    """Analyse all non-registered holdings for loss harvesting opportunities."""
    # Only non-registered accounts
    from ..models.account import Account
    non_reg_types = ["Margin", "Cash", "Joint Non-Reg"]
    accts = db.query(Account).filter(
        Account.account_type.in_(non_reg_types), Account.is_active == True
    ).all()
    results = []
    for acc in accts:
        holdings = db.query(Holding).filter(
            Holding.account_id == acc.id, Holding.is_active == True
        ).all()
        for h in holdings:
            if h.quantity > 0 and h.book_value_cad > 0:
                acb_ps = h.book_value_cad / h.quantity
                analysis = loss_harvest_analysis(
                    symbol=h.symbol,
                    shares=h.quantity,
                    current_price_cad=h.market_value_cad / h.quantity if h.quantity > 0 else 0,
                    acb_per_share=acb_ps,
                    marginal_rate=marginal_rate,
                    other_gains_ytd=ytd_gains,
                )
                if analysis.get("action") == "consider_harvesting":
                    analysis["account"] = acc.name
                    analysis["account_type"] = acc.account_type
                    analysis["holding_name"] = h.name
                    results.append(analysis)
    return sorted(results, key=lambda x: x.get("unrealized_loss", 0), reverse=True)
