"""
Family Trust API.
GET  /api/trusts/                  — list trusts
POST /api/trusts/                  — create trust
GET  /api/trusts/{id}              — get trust with assets
POST /api/trusts/{id}/assets       — add asset to trust
DELETE /api/trusts/{id}            — delete trust
DELETE /api/trusts/{id}/assets/{aid} — delete asset
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from ..database import get_db
from ..models.trust import FamilyTrust, TrustAsset

router = APIRouter(prefix="/api/trusts", tags=["trusts"])


class TrustCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    trust_type: str = "discretionary"
    settled_date: Optional[date] = None
    trustee_names: Optional[str] = None
    beneficiary_names: Optional[str] = None
    province: str = "ON"
    notes: Optional[str] = None


class TrustAssetCreate(BaseModel):
    asset_type: str = Field(..., description="cash | security | real_estate | other")
    name: str = Field(..., min_length=1, max_length=200)
    symbol: Optional[str] = None
    quantity: Optional[float] = None
    book_value_cad: float = 0.0
    market_value_cad: float = 0.0
    acb_per_unit_cad: Optional[float] = None
    notes: Optional[str] = None


@router.get("/")
def list_trusts(db: Session = Depends(get_db)):
    trusts = db.query(FamilyTrust).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "trust_type": t.trust_type,
            "settled_date": t.settled_date,
            "total_market_value_cad": sum(a.market_value_cad for a in t.assets),
            "asset_count": len(t.assets),
        }
        for t in trusts
    ]


@router.post("/")
def create_trust(body: TrustCreate, db: Session = Depends(get_db)):
    trust = FamilyTrust(**body.model_dump())
    db.add(trust)
    db.commit()
    db.refresh(trust)
    return {"id": trust.id, "name": trust.name}


@router.get("/{trust_id}")
def get_trust(trust_id: int, db: Session = Depends(get_db)):
    trust = db.query(FamilyTrust).filter(FamilyTrust.id == trust_id).first()
    if not trust:
        raise HTTPException(status_code=404, detail="Trust not found")
    return {
        "id": trust.id,
        "name": trust.name,
        "trust_type": trust.trust_type,
        "settled_date": trust.settled_date,
        "trustee_names": trust.trustee_names,
        "beneficiary_names": trust.beneficiary_names,
        "province": trust.province,
        "notes": trust.notes,
        "assets": [
            {
                "id": a.id,
                "asset_type": a.asset_type,
                "name": a.name,
                "symbol": a.symbol,
                "quantity": a.quantity,
                "book_value_cad": a.book_value_cad,
                "market_value_cad": a.market_value_cad,
                "acb_per_unit_cad": a.acb_per_unit_cad,
                "notes": a.notes,
            }
            for a in trust.assets
        ],
    }


@router.post("/{trust_id}/assets")
def add_asset(trust_id: int, body: TrustAssetCreate, db: Session = Depends(get_db)):
    trust = db.query(FamilyTrust).filter(FamilyTrust.id == trust_id).first()
    if not trust:
        raise HTTPException(status_code=404, detail="Trust not found")
    asset = TrustAsset(trust_id=trust_id, **body.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return {"id": asset.id}


@router.delete("/{trust_id}")
def delete_trust(trust_id: int, db: Session = Depends(get_db)):
    trust = db.query(FamilyTrust).filter(FamilyTrust.id == trust_id).first()
    if not trust:
        raise HTTPException(status_code=404, detail="Trust not found")
    db.delete(trust)
    db.commit()
    return {"deleted": trust_id}


@router.delete("/{trust_id}/assets/{asset_id}")
def delete_asset(trust_id: int, asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(TrustAsset).filter(TrustAsset.id == asset_id, TrustAsset.trust_id == trust_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    db.delete(asset)
    db.commit()
    return {"deleted": asset_id}
