from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
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
    account_number: Optional[str] = None  # allows fixing PLACEHOLDER-* after first run
    owner: Optional[str] = None           # allows fixing person_a/person_b → sean/saudya
    margin_loan_cad: Optional[float] = None
    margin_rate_pct: Optional[float] = None
    margin_buying_power_cad: Optional[float] = None
    margin_available_cad: Optional[float] = None
    margin_requirement_cad: Optional[float] = None
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
            "margin_buying_power_cad": acc.margin_buying_power_cad,
            "margin_available_cad": acc.margin_available_cad,
            "margin_requirement_cad": acc.margin_requirement_cad,
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


_SEC_TYPE_MAP = {
    "EXCHANGE_TRADED_FUND": "ETF",
    "EQUITY": "Equity",
    "MUTUAL_FUND": "Mutual Fund",
    "BOND": "Bond",
    "OPTION": "Option",
    "CASH": "Cash",
}


@router.post("/holdings/import-csv")
async def import_holdings_csv(
    file: UploadFile = File(...),
    owner: Optional[str] = Form(None),        # "sean" | "saudya" | None = all accounts
    create_missing: str = Form("false"),       # "true" → create holdings not yet in the app
    db: Session = Depends(get_db),
):
    """Import holdings from a broker CSV file.

    Accepts the broker's native export (Questrade and similar).

    owner: filter to a specific person's accounts (omit = all accounts).
    create_missing: when "true", holdings not yet in the app are CREATED from the CSV
      row rather than skipped. Use this for the initial setup import.
      On subsequent imports leave this off — only matched holdings are updated.
    """
    import csv, io

    create_if_missing = create_missing.lower() in ("true", "1", "yes")

    raw = await file.read()
    try:
        file_content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        file_content = raw.decode("latin-1")

    validate_csv_body(file_content)

    fx_row = db.query(AppSettings).filter(AppSettings.key == "fx_cad_usd").first()
    fx_cad_usd = float(fx_row.value) if fx_row and fx_row.value else 1.3650

    def _flt(row: dict, key: str, default: float = 0.0) -> float:
        val = (row.get(key) or "").strip().strip('"')
        try:
            return float(val) if val else default
        except ValueError:
            return default

    reader = csv.DictReader(io.StringIO(file_content))
    updated = 0
    created = 0
    skipped_no_account = 0
    skipped_no_holding = 0
    skipped_wrong_owner = 0

    for row in reader:
        symbol   = (row.get("Symbol")         or "").strip().strip('"')
        acct_num = (row.get("Account Number") or "").strip().strip('"')

        if not symbol or not acct_num:
            continue  # blank rows, "As of …" footer lines, etc.

        qty               = _flt(row, "Quantity")
        price             = _flt(row, "Market Price")
        book_cad          = _flt(row, "Book Value (CAD)")
        market            = _flt(row, "Market Value")
        market_currency   = (row.get("Market Value Currency")  or "CAD").strip().strip('"').upper()
        price_currency_val = (row.get("Market Price Currency") or "CAD").strip().strip('"').upper()
        name_from_csv     = (row.get("Name")                   or "").strip().strip('"')

        market_cad = market * fx_cad_usd if market_currency == "USD" else market

        acc = db.query(Account).filter(Account.account_number == acct_num).first()
        if not acc:
            skipped_no_account += 1
            continue

        # Person filter: skip if this row belongs to a different person.
        # Joint accounts are always included — they appear in every person's
        # broker export and should be updated alongside that person's accounts.
        if owner and acc.owner.lower() not in (owner.lower(), "joint"):
            skipped_wrong_owner += 1
            continue

        h = db.query(Holding).filter(
            Holding.account_id == acc.id,
            Holding.symbol     == symbol,
            Holding.is_active  == True,
        ).first()

        if not h:
            if create_if_missing:
                # Build holding from broker CSV columns
                raw_sec = (row.get("Security Type") or "").strip().strip('"')
                exchange = (row.get("Exchange")     or "TSX").strip().strip('"')
                h = Holding(
                    account_id     = acc.id,
                    symbol         = symbol,
                    name           = name_from_csv or symbol,
                    exchange       = exchange,
                    security_type  = _SEC_TYPE_MAP.get(raw_sec, raw_sec or "ETF"),
                    quantity       = qty,
                    book_value_cad = book_cad,
                    current_price  = price,
                    price_currency = price_currency_val,
                    market_value_cad = market_cad,
                    last_updated   = datetime.utcnow(),
                )
                db.add(h)
                created += 1
                continue          # already set all fields — no further update needed
            else:
                skipped_no_holding += 1
                continue

        # Update existing holding
        h.quantity         = qty
        h.current_price    = price
        h.price_currency   = price_currency_val
        h.book_value_cad   = book_cad
        h.market_value_cad = market_cad
        h.last_updated     = datetime.utcnow()
        if name_from_csv:
            h.name = name_from_csv

        updated += 1

    db.commit()

    parts = [f"Updated {updated} holding(s)."]
    if created:
        parts.append(f"Created {created} new holding(s).")
    if skipped_no_holding:
        parts.append(f"{skipped_no_holding} symbol(s) not found in app (import without 'create missing' to see which).")
    if skipped_no_account:
        parts.append(f"{skipped_no_account} row(s) skipped — account number not in app.")
    if skipped_wrong_owner:
        parts.append(f"{skipped_wrong_owner} row(s) belong to a different person and were skipped.")

    return {"message": " ".join(parts), "updated": updated, "created": created}


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    rows = db.query(AppSettings).all()
    # The API key is managed via /api/ai/key-status and /api/ai/set-key.
    # It must never be returned to the frontend from this endpoint.
    return {r.key: r.value for r in rows if r.key != "anthropic_api_key"}


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
