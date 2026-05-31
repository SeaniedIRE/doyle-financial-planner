"""
What-If Simulation API — run projections with tweaked starting values.
POST /api/whatif/simulate  — run (not saved)
POST /api/whatif/save      — run + save
GET  /api/whatif/          — list saved simulations
DELETE /api/whatif/{id}    — delete saved simulation
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from ..database import get_db
from ..models.whatif import WhatIfSimulation
from ..models.account import AppSettings
from ..models.income import Income
from ..models.scenario import Scenario
from ..services.forecast_engine import project_portfolio

router = APIRouter(prefix="/api/whatif", tags=["what-if"])


class WhatIfRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    override_sean_tfsa: Optional[float] = None
    override_saudya_tfsa: Optional[float] = None
    override_sean_rrsp: Optional[float] = None
    override_saudya_rrsp: Optional[float] = None
    override_sean_fhsa: Optional[float] = None
    override_saudya_fhsa: Optional[float] = None
    override_sean_margin: Optional[float] = None
    override_saudya_margin: Optional[float] = None
    override_sean_cash: Optional[float] = None
    override_saudya_cash: Optional[float] = None
    override_sean_base: Optional[float] = None
    override_saudya_base: Optional[float] = None
    override_house_purchase_year: Optional[int] = None
    override_house_down_payment: Optional[float] = None
    save: bool = False


def _get_setting(db: Session, key: str, fallback: str) -> str:
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    return row.value if row else fallback


def _build_projection(req: WhatIfRequest, db: Session) -> list:
    from ..models.account import Account, Holding

    def account_market_value(owner: str, acct_type: str) -> float:
        accs = db.query(Account).filter(Account.owner == owner, Account.account_type == acct_type).all()
        total = 0.0
        for acc in accs:
            for h in db.query(Holding).filter(Holding.account_id == acc.id).all():
                total += h.market_value_cad or 0
        return total

    def account_margin_loan(owner: str) -> float:
        accs = db.query(Account).filter(Account.owner == owner, Account.account_type == "Margin").all()
        return sum(a.margin_loan_cad or 0 for a in accs)

    def income_field(person: str, field: str, year: int = 2026) -> float:
        inc = db.query(Income).filter(Income.person == person, Income.year == year).first()
        return getattr(inc, field, 0) or 0

    baseline_sc = db.query(Scenario).filter(Scenario.is_baseline == True).first()

    kwargs = dict(
        start_year=2026, end_year=2065,
        sean_tfsa=req.override_sean_tfsa if req.override_sean_tfsa is not None else account_market_value("sean", "TFSA"),
        sean_rrsp=req.override_sean_rrsp if req.override_sean_rrsp is not None else account_market_value("sean", "RRSP"),
        sean_fhsa=req.override_sean_fhsa if req.override_sean_fhsa is not None else account_market_value("sean", "FHSA"),
        sean_margin=req.override_sean_margin if req.override_sean_margin is not None else account_market_value("sean", "Margin"),
        sean_cash=req.override_sean_cash if req.override_sean_cash is not None else account_market_value("sean", "Cash"),
        saudya_tfsa=req.override_saudya_tfsa if req.override_saudya_tfsa is not None else account_market_value("saudya", "TFSA"),
        saudya_rrsp=req.override_saudya_rrsp if req.override_saudya_rrsp is not None else account_market_value("saudya", "RRSP"),
        saudya_fhsa=req.override_saudya_fhsa if req.override_saudya_fhsa is not None else account_market_value("saudya", "FHSA"),
        saudya_lira=account_market_value("saudya", "LIRA"),
        saudya_margin=req.override_saudya_margin if req.override_saudya_margin is not None else account_market_value("saudya", "Margin"),
        saudya_cash=req.override_saudya_cash if req.override_saudya_cash is not None else account_market_value("saudya", "Cash"),
        joint_emergency=account_market_value("joint", "Joint Non-Reg"),
        sean_base=req.override_sean_base if req.override_sean_base is not None else income_field("sean", "employment_income"),
        sean_bonus=income_field("sean", "bonus"),
        sean_other_bonus=income_field("sean", "other_bonus"),
        saudya_base=req.override_saudya_base if req.override_saudya_base is not None else income_field("saudya", "employment_income"),
        saudya_bonus=income_field("saudya", "bonus"),
        sean_margin_loan=account_margin_loan("sean"),
        saudya_margin_loan=account_margin_loan("saudya"),
        margin_rate=3.95,
        mat_leave_1_year=2027, mat_leave_2_year=2028,
        house_purchase_year=req.override_house_purchase_year if req.override_house_purchase_year is not None else (baseline_sc.house_purchase_year if baseline_sc else 2030),
        house_down_payment=req.override_house_down_payment if req.override_house_down_payment is not None else (baseline_sc.house_down_payment_cad if baseline_sc else 200000),
        fhsa_sean_room=8000, fhsa_saudya_room=8000,
        sean_canada_since=int(_get_setting(db, "sean_canada_since", "2018")),
        saudya_canada_since=int(_get_setting(db, "saudya_canada_since", "2009")),
        salary_growth_rate=0.04,
        province=_get_setting(db, "province", "ON"),
    )
    return project_portfolio(**kwargs)


@router.post("/simulate")
def simulate(req: WhatIfRequest, db: Session = Depends(get_db)):
    snaps = _build_projection(req, db)
    result = [
        {
            "year": s.year,
            "combined_net_worth": s.combined_net_worth,
            "sean_income_after_tax": s.sean_income_after_tax,
            "saudya_income_after_tax": s.saudya_income_after_tax,
            "events": s.events,
        }
        for s in snaps
    ]
    if req.save:
        sim = WhatIfSimulation(
            name=req.name,
            description=req.description,
            override_sean_tfsa=req.override_sean_tfsa,
            override_saudya_tfsa=req.override_saudya_tfsa,
            override_sean_rrsp=req.override_sean_rrsp,
            override_saudya_rrsp=req.override_saudya_rrsp,
            override_sean_fhsa=req.override_sean_fhsa,
            override_saudya_fhsa=req.override_saudya_fhsa,
            override_sean_margin=req.override_sean_margin,
            override_saudya_margin=req.override_saudya_margin,
            override_sean_cash=req.override_sean_cash,
            override_saudya_cash=req.override_saudya_cash,
            override_sean_base=req.override_sean_base,
            override_saudya_base=req.override_saudya_base,
            override_house_purchase_year=req.override_house_purchase_year,
            override_house_down_payment=req.override_house_down_payment,
            result_json=result,
            is_saved=True,
        )
        db.add(sim)
        db.commit()
        db.refresh(sim)
        return {"id": sim.id, "result": result}
    return {"result": result}


@router.get("/")
def list_simulations(db: Session = Depends(get_db)):
    sims = db.query(WhatIfSimulation).filter(WhatIfSimulation.is_saved == True).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "created_at": s.created_at,
        }
        for s in sims
    ]


@router.get("/{sim_id}")
def get_simulation(sim_id: int, db: Session = Depends(get_db)):
    sim = db.query(WhatIfSimulation).filter(WhatIfSimulation.id == sim_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return sim


@router.delete("/{sim_id}")
def delete_simulation(sim_id: int, db: Session = Depends(get_db)):
    sim = db.query(WhatIfSimulation).filter(WhatIfSimulation.id == sim_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    db.delete(sim)
    db.commit()
    return {"deleted": sim_id}
