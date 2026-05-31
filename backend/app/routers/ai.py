from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from ..database import get_db
from ..models.account import Account, Holding, AppSettings
from ..models.income import Income
from ..services.claude_service import (
    ask_claude, validate_tax_strategy, get_loss_harvest_advice,
    get_fhsa_strategy, annual_review_prompt,
)
from ..security import check_ai_rate_limit

router = APIRouter(prefix="/api/ai", tags=["ai"])


# ─────────────────────────────────────────────────────────────────────
# Internal helper — resolve the API key for a request.
# Priority: env var (Docker) > DB-stored value (set via UI).
# The key is NEVER returned to the frontend in any response.
# ─────────────────────────────────────────────────────────────────────

_KEY_FILE = "/app/data/anthropic_api_key.txt"


def _get_api_key(db: Session) -> str:
    """Return the best available Anthropic API key for this request.

    Priority order:
      1. ANTHROPIC_API_KEY Docker env var  (set it in Unraid template for zero-config)
      2. app_settings DB row               (set via Settings → AI Advisor Key)
      3. /app/data/anthropic_api_key.txt   (file fallback — survives DB wipes)
    """
    import os
    from ..config import settings
    if settings.anthropic_api_key:
        return settings.anthropic_api_key
    row = db.query(AppSettings).filter(AppSettings.key == "anthropic_api_key").first()
    if row and row.value:
        return row.value
    # Final fallback: key file written by set_key() — survives container rebuilds
    try:
        if os.path.isfile(_KEY_FILE):
            key = open(_KEY_FILE).read().strip()
            if key:
                return key
    except Exception:
        pass
    return ""


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    include_portfolio_context: bool = True
    year: int = Field(default=2026, ge=2020, le=2070)


class StrategyRequest(BaseModel):
    name: str
    description: str
    actions: list[str]


class SetKeyRequest(BaseModel):
    api_key: str = Field(..., min_length=20, max_length=300)


# ─────────────────────────────────────────────────────────────────────
# Key management endpoints (no rate-limit — not AI calls)
# ─────────────────────────────────────────────────────────────────────

@router.get("/key-status")
def key_status(db: Session = Depends(get_db)):
    """Return whether an API key is configured and where it came from.
    The key value is NEVER included in the response.
    """
    import os
    from ..config import settings
    if settings.anthropic_api_key:
        return {"configured": True, "source": "env"}
    row = db.query(AppSettings).filter(AppSettings.key == "anthropic_api_key").first()
    if row and row.value:
        return {"configured": True, "source": "db"}
    try:
        if os.path.isfile(_KEY_FILE) and open(_KEY_FILE).read().strip():
            return {"configured": True, "source": "file"}
    except Exception:
        pass
    return {"configured": False, "source": "none"}


@router.post("/set-key")
def set_key(req: SetKeyRequest, db: Session = Depends(get_db)):
    """Store an Anthropic API key in the database AND a persistent file.

    Two-layer persistence:
      - app_settings table → survives container restarts while DB volume is mounted
      - /app/data/anthropic_api_key.txt → belt-and-suspenders; survives DB wipes
        as long as the /app/data volume is intact (which it must be for all data).
    The env-var always takes priority — set ANTHROPIC_API_KEY in Unraid to avoid
    needing this endpoint at all.
    """
    import os, stat
    if not req.api_key.startswith("sk-ant-"):
        raise HTTPException(
            status_code=422,
            detail="Invalid key format — Anthropic keys start with 'sk-ant-'.",
        )
    # 1 — Save to DB
    row = db.query(AppSettings).filter(AppSettings.key == "anthropic_api_key").first()
    if row:
        row.value = req.api_key
        row.updated_at = datetime.utcnow()
    else:
        db.add(AppSettings(key="anthropic_api_key", value=req.api_key))
    db.commit()

    # 2 — Save to file (belt-and-suspenders; restricts read to owner only)
    try:
        os.makedirs(os.path.dirname(_KEY_FILE), exist_ok=True)
        with open(_KEY_FILE, "w") as f:
            f.write(req.api_key)
        os.chmod(_KEY_FILE, stat.S_IRUSR | stat.S_IWUSR)   # chmod 600
    except Exception:
        pass  # file write is a bonus — don't fail if /app/data isn't writable

    return {"message": "API key saved — AI Advisor is now ready."}


@router.post("/ask")
def ask(req: AskRequest, request: Request, db: Session = Depends(get_db)):
    """Free-form question to Claude with optional portfolio context."""
    check_ai_rate_limit(request)
    api_key = _get_api_key(db)
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
    response = ask_claude(req.question, context, api_key=api_key)
    return {"response": response}


@router.post("/validate-strategy")
def validate_strategy(req: StrategyRequest, request: Request, db: Session = Depends(get_db)):
    check_ai_rate_limit(request)
    api_key = _get_api_key(db)
    response = validate_tax_strategy(req.model_dump(), api_key=api_key)
    return {"response": response}


@router.post("/loss-harvest-advice/{holding_id}")
def loss_harvest_ai(holding_id: int, request: Request, db: Session = Depends(get_db)):
    check_ai_rate_limit(request)
    api_key = _get_api_key(db)
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
    portfolio_data = {"ytd_gains": 0}
    response = get_loss_harvest_advice(holding_data, portfolio_data, api_key=api_key)
    return {"response": response}


@router.get("/fhsa-strategy")
def fhsa_strategy_advice(request: Request, house_year: int = 2030, house_price: float = 900000, db: Session = Depends(get_db)):
    check_ai_rate_limit(request)
    api_key = _get_api_key(db)
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
    response = get_fhsa_strategy(sean, saudya, api_key=api_key)
    return {"response": response}


@router.get("/annual-review/{year}")
def annual_review(year: int, request: Request, db: Session = Depends(get_db)):
    check_ai_rate_limit(request)
    api_key = _get_api_key(db)
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
            return r.combined_marginal
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
    response = annual_review_prompt(year, sean_data, saudya_data, portfolio_data, api_key=api_key)
    return {"response": response}
