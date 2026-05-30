from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..database import get_db
from ..models.income import Income

router = APIRouter(prefix="/api/income", tags=["income"])


class IncomeCreate(BaseModel):
    person: str
    year: int
    employment_income: float = 0.0
    bonus: float = 0.0
    other_bonus: float = 0.0
    investment_income: float = 0.0
    rental_income: float = 0.0
    other_income: float = 0.0
    province: str = "ON"
    is_maternity_leave: bool = False
    maternity_ei_income: float = 0.0
    notes: str = ""


class IncomeUpdate(BaseModel):
    employment_income: Optional[float] = None
    bonus: Optional[float] = None
    other_bonus: Optional[float] = None
    investment_income: Optional[float] = None
    rental_income: Optional[float] = None
    other_income: Optional[float] = None
    province: Optional[str] = None
    is_maternity_leave: Optional[bool] = None
    maternity_ei_income: Optional[float] = None
    notes: Optional[str] = None


def income_to_dict(inc: Income) -> dict:
    return {
        "id": inc.id,
        "person": inc.person,
        "year": inc.year,
        "employment_income": inc.employment_income,
        "bonus": inc.bonus,
        "other_bonus": inc.other_bonus,
        "investment_income": inc.investment_income,
        "rental_income": inc.rental_income,
        "other_income": inc.other_income,
        "total_gross": inc.employment_income + inc.bonus + inc.other_bonus + inc.investment_income + inc.rental_income + inc.other_income,
        "province": inc.province,
        "is_maternity_leave": inc.is_maternity_leave,
        "maternity_ei_income": inc.maternity_ei_income,
        "notes": inc.notes,
    }


@router.get("/")
def list_income(db: Session = Depends(get_db)):
    rows = db.query(Income).order_by(Income.year.desc(), Income.person).all()
    return [income_to_dict(r) for r in rows]


@router.get("/{person}")
def get_income_by_person(person: str, db: Session = Depends(get_db)):
    rows = db.query(Income).filter(Income.person == person).order_by(Income.year.desc()).all()
    return [income_to_dict(r) for r in rows]


@router.post("/")
def create_income(data: IncomeCreate, db: Session = Depends(get_db)):
    existing = db.query(Income).filter(
        Income.person == data.person, Income.year == data.year
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Income for {data.person} year {data.year} already exists. Use PUT to update.")
    inc = Income(**data.model_dump())
    db.add(inc)
    db.commit()
    db.refresh(inc)
    return income_to_dict(inc)


@router.put("/{income_id}")
def update_income(income_id: int, data: IncomeUpdate, db: Session = Depends(get_db)):
    inc = db.query(Income).filter(Income.id == income_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(inc, k, v)
    inc.updated_at = datetime.utcnow()
    db.commit()
    return income_to_dict(inc)


@router.delete("/{income_id}")
def delete_income(income_id: int, db: Session = Depends(get_db)):
    inc = db.query(Income).filter(Income.id == income_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(inc)
    db.commit()
    return {"message": "Deleted"}
