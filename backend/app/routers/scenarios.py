from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..database import get_db
from ..models.scenario import Scenario, ForecastEntry
from ..models.account import Account, Holding
from ..models.income import Income
from ..services.forecast_engine import project_portfolio

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


class ScenarioCreate(BaseModel):
    name: str
    description: str = ""
    is_baseline: bool = False
    growth_conservative_pct: float = 5.0
    growth_moderate_pct: float = 7.0
    growth_optimistic_pct: float = 10.0
    house_purchase_year: int = 2030
    house_price_cad: float = 900000.0
    house_down_payment_cad: float = 200000.0
    assumptions: dict = {}


class ScenarioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    growth_conservative_pct: Optional[float] = None
    growth_moderate_pct: Optional[float] = None
    growth_optimistic_pct: Optional[float] = None
    house_purchase_year: Optional[int] = None
    house_price_cad: Optional[float] = None
    house_down_payment_cad: Optional[float] = None
    assumptions: Optional[dict] = None


def scenario_to_dict(s: Scenario) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "is_baseline": s.is_baseline,
        "growth_conservative_pct": s.growth_conservative_pct,
        "growth_moderate_pct": s.growth_moderate_pct,
        "growth_optimistic_pct": s.growth_optimistic_pct,
        "house_purchase_year": s.house_purchase_year,
        "house_price_cad": s.house_price_cad,
        "house_down_payment_cad": s.house_down_payment_cad,
        "assumptions": s.assumptions or {},
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("/")
def list_scenarios(db: Session = Depends(get_db)):
    return [scenario_to_dict(s) for s in db.query(Scenario).filter(Scenario.is_active == True).all()]


@router.post("/")
def create_scenario(data: ScenarioCreate, db: Session = Depends(get_db)):
    s = Scenario(**data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return scenario_to_dict(s)


@router.put("/{scenario_id}")
def update_scenario(scenario_id: int, data: ScenarioUpdate, db: Session = Depends(get_db)):
    s = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    s.updated_at = datetime.utcnow()
    db.commit()
    return scenario_to_dict(s)


@router.delete("/{scenario_id}")
def delete_scenario(scenario_id: int, db: Session = Depends(get_db)):
    s = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    s.is_active = False
    db.commit()
    return {"message": "Deactivated"}


@router.post("/{scenario_id}/run")
def run_forecast(
    scenario_id: int,
    start_year: int = 2026,
    end_year: int = 2040,
    mat_leave_1_year: int = 2027,
    mat_leave_2_year: int = 2028,
    sean_margin_loan: float = 100000,
    saudya_margin_loan: float = 100000,
    margin_rate: float = 3.95,
    sean_canada_since: int = 2018,
    saudya_canada_since: int = 2009,
    salary_growth_rate: float = 0.04,
    db: Session = Depends(get_db),
):
    """Run a multi-year portfolio forecast for this scenario."""
    s = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Load current account balances
    def get_balance(owner: str, acct_type: str) -> float:
        accs = db.query(Account).filter(
            Account.owner == owner, Account.account_type == acct_type, Account.is_active == True
        ).all()
        total = 0.0
        for acc in accs:
            hs = db.query(Holding).filter(Holding.account_id == acc.id, Holding.is_active == True).all()
            total += sum(h.market_value_cad for h in hs)
        return total

    # Load income for start_year
    def get_income(person: str, year: int):
        return db.query(Income).filter(Income.person == person, Income.year == year).first()

    sean_inc = get_income("sean", start_year)
    saudya_inc = get_income("saudya", start_year)

    sean_base = sean_inc.employment_income if sean_inc else 245000
    sean_bonus = (sean_inc.bonus + sean_inc.other_bonus) if sean_inc else 80000
    saudya_base = saudya_inc.employment_income if saudya_inc else 106000
    saudya_bonus = saudya_inc.bonus if saudya_inc else 15000

    # Override growth rates with scenario values
    from ..services import forecast_engine
    forecast_engine.GROWTH_RATES["conservative"] = s.growth_conservative_pct / 100
    forecast_engine.GROWTH_RATES["moderate"] = s.growth_moderate_pct / 100
    forecast_engine.GROWTH_RATES["optimistic"] = s.growth_optimistic_pct / 100

    snapshots = project_portfolio(
        start_year=start_year,
        end_year=end_year,
        sean_tfsa=get_balance("sean", "TFSA"),
        sean_rrsp=get_balance("sean", "RRSP"),
        sean_fhsa=get_balance("sean", "FHSA"),
        sean_margin=get_balance("sean", "Margin"),
        sean_cash=get_balance("sean", "Cash"),
        saudya_tfsa=get_balance("saudya", "TFSA"),
        saudya_rrsp=get_balance("saudya", "RRSP"),
        saudya_fhsa=get_balance("saudya", "FHSA"),
        saudya_lira=get_balance("saudya", "LIRA"),
        saudya_margin=get_balance("saudya", "Margin"),
        saudya_cash=get_balance("saudya", "Cash"),
        joint_emergency=get_balance("joint", "Joint Non-Reg"),
        sean_base=sean_base,
        sean_bonus=sean_bonus,
        sean_other_bonus=0,
        saudya_base=saudya_base,
        saudya_bonus=saudya_bonus,
        sean_margin_loan=sean_margin_loan,
        saudya_margin_loan=saudya_margin_loan,
        margin_rate=margin_rate,
        mat_leave_1_year=mat_leave_1_year,
        mat_leave_2_year=mat_leave_2_year,
        house_purchase_year=s.house_purchase_year,
        house_down_payment=s.house_down_payment_cad,
        salary_growth_rate=salary_growth_rate,
    )

    return [
        {
            "year": snap.year,
            "sean_net_worth": snap.sean_net_worth,
            "saudya_net_worth": snap.saudya_net_worth,
            "combined_net_worth": snap.combined_net_worth,
            "sean_income_after_tax": snap.sean_income_after_tax,
            "saudya_income_after_tax": snap.saudya_income_after_tax,
            "sean_tax": snap.sean_tax,
            "saudya_tax": snap.saudya_tax,
            "tfsa_sean": snap.tfsa_sean_value,
            "tfsa_saudya": snap.tfsa_saudya_value,
            "rrsp_sean": snap.rrsp_sean_value,
            "rrsp_saudya": snap.rrsp_saudya_value,
            "fhsa_sean": snap.fhsa_sean_value,
            "fhsa_saudya": snap.fhsa_saudya_value,
            "margin_sean": snap.margin_sean_value,
            "margin_saudya": snap.margin_saudya_value,
            "joint": snap.joint_value,
            "events": snap.events,
        }
        for snap in snapshots
    ]
