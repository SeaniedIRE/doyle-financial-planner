from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from ..database import get_db
from ..models.account import Account, Holding
from ..models.income import Income
from ..services.claude_service import (
    ask_claude, validate_tax_strategy, get_loss_harvest_advice,
    get_fhsa_strategy, annual_review_prompt,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


class AskRequest(BaseModel):
    question: str
    include_portfolio_context: bool = True
    year: int = 2026


class StrategyRequest(BaseModel):
    name: str
    description: str
    actions: list[str]


@router.post("/ask")
def ask(req: AskRequest, db: Session = Depends(get_db)):
    """Free-form question to Claude with optional portfolio context."""
    context = None
    if req.include_portfolio_context:
        accounts = db.query(Account).filter(Account.is_active == True).all()
        portfolio_summary = {}
        for acc in accounts:
            hs = db.query(Holding).filter(Holding.account_id == acc.id, Holding.is_active == True).all()
            portfolio_summary[f"{acc.owner}_{acc.account_type}_{acc.name}"] = {
                "market_value_cad": sum(h.market_value_cad for h in hs),
                "book_value_cad": sum(h.book_value_cad for h in hs),
                "holdings": [{"symbol": h.symbol, "qty": h.quantity, "market_value": h.market_value_cad} for h in hs],
            }
        context = {"portfolio": portfolio_summary, "year": req.year}
    response = ask_claude(req.question, context)
    return {"response": response}


@router.post("/validate-strategy")
def validate_strategy(req: StrategyRequest):
    response = validate_tax_strategy(req.model_dump())
    return {"response": response}


@router.post("/loss-harvest-advice/{holding_id}")
def loss_harvest_ai(holding_id: int, db: Session = Depends(get_db)):
    h = db.query(Holding).filter(Holding.id == holding_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Holding not found")
    acc = db.query(Account).filter(Account.id == h.account_id).first()
    holding_data = {
        "symbol": h.symbol,
        "name": h.name,
        "book_value_cad": h.book_value_cad,
        "market_value_cad": h.market_value_cad,
        "unrealized_loss": h.market_value_cad - h.book_value_cad,
        "account_type": acc.account_type if acc else "Unknown",
    }
    portfolio_data = {"ytd_gains": 0}  # user can supply via query param
    response = get_loss_harvest_advice(holding_data, portfolio_data)
    return {"response": response}


@router.get("/fhsa-strategy")
def fhsa_strategy_advice(house_year: int = 2030, house_price: float = 900000, db: Session = Depends(get_db)):
    def get_balance(owner, at):
        accs = db.query(Account).filter(Account.owner == owner, Account.account_type == at, Account.is_active == True).all()
        total = 0.0
        for acc in accs:
            hs = db.query(Holding).filter(Holding.account_id == acc.id, Holding.is_active == True).all()
            total += sum(h.market_value_cad for h in hs)
        return total

    sean = {
        "fhsa_balance": get_balance("sean", "FHSA"),
        "fhsa_contributed": 35052,
        "rrsp_balance": get_balance("sean", "RRSP"),
        "house_price": house_price,
        "house_year": house_year,
    }
    saudya = {
        "fhsa_balance": get_balance("saudya", "FHSA"),
        "fhsa_contributed": 35213,
        "rrsp_balance": get_balance("saudya", "RRSP"),
    }
    response = get_fhsa_strategy(sean, saudya)
    return {"response": response}


@router.get("/annual-review/{year}")
def annual_review(year: int, db: Session = Depends(get_db)):
    def get_inc(person):
        return db.query(Income).filter(Income.person == person, Income.year == year).first()

    sean_inc = get_inc("sean")
    saudya_inc = get_inc("saudya")

    def get_balance(owner, at):
        accs = db.query(Account).filter(Account.owner == owner, Account.account_type == at, Account.is_active == True).all()
        total = 0.0
        for acc in accs:
            hs = db.query(Holding).filter(Holding.account_id == acc.id, Holding.is_active == True).all()
            total += sum(h.market_value_cad for h in hs)
        return total

    all_non_reg = db.query(Account).filter(
        Account.account_type.in_(["Margin", "Cash", "Joint Non-Reg"]), Account.is_active == True
    ).all()
    unrealized_losses = 0.0
    unrealized_gains = 0.0
    for acc in all_non_reg:
        hs = db.query(Holding).filter(Holding.account_id == acc.id, Holding.is_active == True).all()
        for h in hs:
            diff = h.market_value_cad - h.book_value_cad
            if diff < 0:
                unrealized_losses += abs(diff)
            else:
                unrealized_gains += diff

    sean_data = {
        "base": sean_inc.employment_income if sean_inc else 245000,
        "bonus": (sean_inc.bonus + sean_inc.other_bonus) if sean_inc else 80000,
        "rrsp_balance": get_balance("sean", "RRSP"),
        "tfsa_balance": get_balance("sean", "TFSA"),
        "rrsp_room": 32490,
        "tfsa_room": 7000,
        "fhsa_room": 8000,
        "marginal_rate": 53,
    }
    saudya_data = {
        "base": saudya_inc.employment_income if saudya_inc else 106000,
        "bonus": saudya_inc.bonus if saudya_inc else 15000,
        "rrsp_balance": get_balance("saudya", "RRSP"),
        "tfsa_balance": get_balance("saudya", "TFSA"),
        "rrsp_room": 22000,
        "tfsa_room": 7000,
        "fhsa_room": 8000,
        "marginal_rate": 43,
    }
    portfolio_data = {
        "unrealized_losses": round(unrealized_losses, 2),
        "unrealized_gains": round(unrealized_gains, 2),
        "ytd_gains": 0,
        "sean_margin_loan": 100000,
        "saudya_margin_loan": 100000,
        "margin_rate": 3.95,
    }
    response = annual_review_prompt(year, sean_data, saudya_data, portfolio_data)
    return {"response": response}
