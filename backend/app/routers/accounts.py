from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from ..database import get_db
from ..models.account import Account, Holding, AppSettings
from ..security import validate_settings_keys, validate_csv_body

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


class AccountCreate(BaseModel):
    name: str
    account_type: str
    owner: str
    account_number: str
    currency: str = "CAD"
    margin_loan_cad: float = 0.0
    margin_rate_pct: float = 3.95
    notes: str = ""


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    margin_loan_cad: Optional[float] = None
    margin_rate_pct: Optional[float] = None
    notes: Optional[str] = None


class HoldingCreate(BaseModel):
    account_id: int
    symbol: str
    exchange: str = "TSX"
    name: str
    security_type: str = "ETF"
    quantity: float
    book_value_cad: float
    current_price: float
    price_currency: str = "CAD"
    market_value_cad: float
    notes: str = ""


class HoldingUpdate(BaseModel):
    quantity: Optional[float] = None
    book_value_cad: Optional[float] = None
    current_price: Optional[float] = None
    market_value_cad: Optional[float] = None
    notes: Optional[str] = None


@router.get("/")
def list_accounts(db: Session = Depends(get_db)):
    accounts = db.query(Account).filter(Account.is_active == True).all()
    result = []
    for acc in accounts:
        holdings = db.query(Holding).filter(
            Holding.account_id == acc.id, Holding.is_active == True
        ).all()
        total_book = sum(h.book_value_cad for h in holdings)
        total_market = sum(h.market_value_cad for h in holdings)
        result.append({
            "id": acc.id,
            "name": acc.name,
            "account_type": acc.account_type,
            "owner": acc.owner,
            "account_number": acc.account_number,
            "currency": acc.currency,
            "margin_loan_cad": acc.margin_loan_cad,
            "margin_rate_pct": acc.margin_rate_pct,
            "notes": acc.notes,
            "total_book_value_cad": round(total_book, 2),
            "total_market_value_cad": round(total_market, 2),
            "unrealized_gain_cad": round(total_market - total_book, 2),
            "holdings_count": len(holdings),
        })
    return result


@router.post("/")
def create_account(data: AccountCreate, db: Session = Depends(get_db)):
    acc = Account(**data.model_dump())
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return {"id": acc.id, "message": "Account created"}


@router.put("/{account_id}")
def update_account(account_id: int, data: AccountUpdate, db: Session = Depends(get_db)):
    acc = db.query(Account).filter(Account.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(acc, k, v)
    acc.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Updated"}


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    acc = db.query(Account).filter(Account.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    acc.is_active = False
    db.commit()
    return {"message": "Deactivated"}


# ---- Holdings ----

@router.get("/{account_id}/holdings")
def list_holdings(account_id: int, db: Session = Depends(get_db)):
    holdings = db.query(Holding).filter(
        Holding.account_id == account_id, Holding.is_active == True
    ).all()
    return [
        {
            "id": h.id,
            "symbol": h.symbol,
            "exchange": h.exchange,
            "name": h.name,
            "security_type": h.security_type,
            "quantity": h.quantity,
            "book_value_cad": h.book_value_cad,
            "current_price": h.current_price,
            "price_currency": h.price_currency,
            "market_value_cad": h.market_value_cad,
            "unrealized_gain_cad": round(h.market_value_cad - h.book_value_cad, 2),
            "unrealized_pct": round(
                (h.market_value_cad - h.book_value_cad) / h.book_value_cad * 100, 2
            ) if h.book_value_cad > 0 else 0,
            "acb_per_share": round(h.book_value_cad / h.quantity, 4) if h.quantity > 0 else 0,
            "last_updated": h.last_updated.isoformat() if h.last_updated else None,
            "notes": h.notes,
        }
        for h in holdings
    ]


@router.post("/holdings")
def create_holding(data: HoldingCreate, db: Session = Depends(get_db)):
    h = Holding(**data.model_dump())
    db.add(h)
    db.commit()
    db.refresh(h)
    return {"id": h.id, "message": "Holding created"}


@router.put("/holdings/{holding_id}")
def update_holding(holding_id: int, data: HoldingUpdate, db: Session = Depends(get_db)):
    h = db.query(Holding).filter(Holding.id == holding_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Holding not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(h, k, v)
    h.last_updated = datetime.utcnow()
    db.commit()
    return {"message": "Updated"}


@router.delete("/holdings/{holding_id}")
def delete_holding(holding_id: int, db: Session = Depends(get_db)):
    h = db.query(Holding).filter(Holding.id == holding_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Holding not found")
    h.is_active = False
    db.commit()
    return {"message": "Deactivated"}


@router.get("/summary/totals")
def portfolio_totals(db: Session = Depends(get_db)):
    """High-level portfolio summary for dashboard."""
    accounts = db.query(Account).filter(Account.is_active == True).all()
    totals = {"sean": {}, "saudya": {}, "joint": {}, "combined": {}}
    account_types = ["TFSA", "RRSP", "FHSA", "LIRA", "Margin", "Cash", "Joint Non-Reg"]
    for owner in ["sean", "saudya", "joint"]:
        for at in account_types:
            accs = [a for a in accounts if a.owner == owner and a.account_type == at]
            market = 0.0
            book = 0.0
            for a in accs:
                hs = db.query(Holding).filter(Holding.account_id == a.id, Holding.is_active == True).all()
                market += sum(h.market_value_cad for h in hs)
                book += sum(h.book_value_cad for h in hs)
            if accs:
                totals[owner][at] = {
                    "market_value_cad": round(market, 2),
                    "book_value_cad": round(book, 2),
                    "unrealized": round(market - book, 2),
                }

    all_holdings = db.query(Holding).filter(Holding.is_active == True).all()
    totals["combined"]["total_market"] = round(sum(h.market_value_cad for h in all_holdings), 2)
    totals["combined"]["total_book"] = round(sum(h.book_value_cad for h in all_holdings), 2)
    totals["combined"]["total_unrealized"] = round(
        totals["combined"]["total_market"] - totals["combined"]["total_book"], 2
    )
    return totals


@router.post("/holdings/import-csv")
async def import_holdings_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Import holdings from a broker CSV file. Matches by symbol + account_number.

    Required CSV columns (case-sensitive):
        Account Number, Symbol, Quantity, Market Price, Book Value (CAD), Market Value
    """
    import csv, io
    raw = await file.read()
    try:
        file_content = raw.decode("utf-8")
    except UnicodeDecodeError:
        file_content = raw.decode("latin-1")  # fallback for some broker exports
    validate_csv_body(file_content)
    reader = csv.DictReader(io.StringIO(file_content))
    updated = 0
    for row in reader:
        symbol = row.get("Symbol", "").strip().strip('"')
        acct_num = row.get("Account Number", "").strip().strip('"')
        qty = float(row.get("Quantity", 0))
        price = float(row.get("Market Price", 0))
        book = float(row.get("Book Value (CAD)", 0))
        market = float(row.get("Market Value", 0))

        acc = db.query(Account).filter(Account.account_number == acct_num).first()
        if not acc:
            continue
        h = db.query(Holding).filter(
            Holding.account_id == acc.id, Holding.symbol == symbol, Holding.is_active == True
        ).first()
        if h:
            h.quantity = qty
            h.current_price = price
            h.book_value_cad = book
            h.market_value_cad = market
            h.last_updated = datetime.utcnow()
            updated += 1
    db.commit()
    return {"message": f"Updated {updated} holdings"}


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    rows = db.query(AppSettings).all()
    return {r.key: r.value for r in rows}


@router.put("/settings")
def update_settings(data: dict, db: Session = Depends(get_db)):
    # Whitelist check — only known keys accepted (OWASP A03 / ASVS V5.1.3)
    validate_settings_keys(data)
    for key, value in data.items():
        row = db.query(AppSettings).filter(AppSettings.key == key).first()
        if row:
            row.value = str(value)
        else:
            db.add(AppSettings(key=key, value=str(value)))
    db.commit()
    return {"message": "Settings updated"}
