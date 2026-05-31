from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from ..database import get_db
from ..models.account import Account, Holding
from ..models.income import Income
from ..services.claude_service import (
    ask_claude, validate_tax_strategy, get_loss_harvest_advice,
    get_fhsa_strategy, annual_review_prompt,
)
from ..security import check_ai_rate_limit

router = APIRouter(prefix="/api/ai", tags=["ai"])


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    include_portfolio_context: bool = True
    year: int = Field(default=2026, ge=2020, le=2070)


class StrategyRequest(BaseModel):
    name: str
    description: str
    actions: list[str]


@router.post("/ask")
def ask(req: AskRequest, request: Request, db: Session = Depends(get_db)):
    """Free-form question to Claude with optional portfolio context."""
    check_ai_rate_limit(request)
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
def validate_strategy(req: StrategyRequest, request: Request):
    check_ai_rate_limit(request)
    response = validate_tax_strategy(req.model_dump())
    return {"response": response}


@router.post("/loss-harvest-advice/{holding_id}")
def loss_harvest_ai(holding_id: int, request: Request, db: Session = Depends(get_db)):
    check_ai_rate_limit(request)
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
def fhsa_strategy_advice(request: Request, house_year: int = 2030, house_price: float = 900000, db: Session = Depends(get_db)):
    check_ai_rate_limit(request)
    def get_balance(owner, at):
        accs = db.query(Account).filter(Account.owner == owner, Account.account_type == at, Account.is_active == True).all()
        total = 0.0
        for acc in accs:
            hs = db.query(Holding).filter(Holding.account_id == acc.id, Holding.is_active == True).all()
            total += sum(h.market_value_cad for h in hs)
        return total

    from ..models.room import ContributionRoom
    def fhsa_contributed(owner: str) -> float:
        # 40000 lifetime limit minus current room available
        room = db.query(ContributionRoom).filter(
            ContributionRoom.person == owner,
            ContributionRoom.account_type == "FHSA",
        ).order_by(ContributionRoom.year.desc()).first()
        return max(0, 40000 - (room.room_available if room else 40000))

    sean = {
        "fhsa_balance": get_balance("sean", "FHSA"),
        "fhsa_contributed": fhsa_contributed("sean"),
        "rrsp_balance": get_balance("sean", "RRSP"),
        "house_price": house_price,
        "house_year": house_year,
    }
    saudya = {
        "fhsa_balance": get_balance("saudya", "FHSA"),
        "fhsa_contributed": fhsa_contributed("saudya"),
        "rrsp_balance": get_balance("saudya", "RRSP"),
    }
    response = get_fhsa_strategy(sean, saudya)
    return {"response": response}


@router.get("/annual-review/{year}")
def annual_review(year: int, request: Request, db: Session = Depends(get_db)):
    check_ai_rate_limit(request)
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

    from ..models.room import ContributionRoom
    from ..models.account import AppSettings
    from ..services.tax_engine import rrsp_room as calc_rrsp_room

    def get_room(person: str, account_type: str) -> float:
        row = db.query(ContributionRoom).filter(
            ContributionRoom.person == person,
            ContributionRoom.account_type == account_type,
        ).order_by(ContributionRoom.year.desc()).first()
        return row.room_available if row else 0

    def get_margin_loan(owner: str) -> float:
        from ..models.account import Account as Acc
        accs = db.query(Acc).filter(Acc.owner == owner, Acc.account_type == "Margin", Acc.is_active == True).all()
        return sum(a.margin_loan_cad or 0 for a in accs)

    def get_marginal(inc_obj) -> float:
        if not inc_obj:
            return 0.0
        try:
            from ..services.tax_engine import calculate_annual_tax
            r = calculate_annual_tax(year=year, employment_income=inc_obj.employment_income or 0, bonus=(inc_obj.bonus or 0) + (getattr(inc_obj, 'other_bonus', None) or 0))
            return r.combined_marginal_pct
        except Exception:
            return 0.0

    sean_data = {
        "base": sean_inc.employment_income if sean_inc else 0,
        "bonus": ((sean_inc.bonus or 0) + (getattr(sean_inc, 'other_bonus', None) or 0)) if sean_inc else 0,
        "rrsp_balance": get_balance("sean", "RRSP"),
        "tfsa_balance": get_balance("sean", "TFSA"),
        "rrsp_room": get_room("sean", "RRSP"),
        "tfsa_room": get_room("sean", "TFSA"),
        "fhsa_room": get_room("sean", "FHSA"),
        "marginal_rate": get_marginal(sean_inc),
    }
    saudya_data = {
        "base": saudya_inc.employment_income if saudya_inc else 0,
        "bonus": (saudya_inc.bonus or 0) if saudya_inc else 0,
        "rrsp_balance": get_balance("saudya", "RRSP"),
        "tfsa_balance": get_balance("saudya", "TFSA"),
        "rrsp_room": get_room("saudya", "RRSP"),
        "tfsa_room": get_room("saudya", "TFSA"),
        "fhsa_room": get_room("saudya", "FHSA"),
        "marginal_rate": get_marginal(saudya_inc),
    }
    portfolio_data = {
        "unrealized_losses": round(unrealized_losses, 2),
        "unrealized_gains": round(unrealized_gains, 2),
        "ytd_gains": 0,
        "sean_margin_loan": get_margin_loan("sean"),
        "saudya_margin_loan": get_margin_loan("saudya"),
        "margin_rate": float(db.query(AppSettings).filter(AppSettings.key == "margin_rate").first().value
                            if db.query(AppSettings).filter(AppSettings.key == "margin_rate").first() else 3.95),
    }
    response = annual_review_prompt(year, sean_data, saudya_data, portfolio_data)
    return {"response": response}
