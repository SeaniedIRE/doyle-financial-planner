from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, JSON
from datetime import datetime, timezone
from ..database import Base


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    is_baseline = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    growth_conservative_pct = Column(Float, default=5.0)
    growth_moderate_pct = Column(Float, default=7.0)
    growth_optimistic_pct = Column(Float, default=10.0)
    house_purchase_year = Column(Integer, default=2030)
    house_price_cad = Column(Float, default=900000.0)
    house_down_payment_cad = Column(Float, default=200000.0)
    assumptions = Column(JSON, default={})
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ForecastEntry(Base):
    __tablename__ = "forecast_entries"

    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    account_id = Column(Integer, nullable=True)
    account_type = Column(String, nullable=True)
    person = Column(String, nullable=True)
    value_conservative = Column(Float, default=0.0)
    value_moderate = Column(Float, default=0.0)
    value_optimistic = Column(Float, default=0.0)
    net_worth_conservative = Column(Float, default=0.0)
    net_worth_moderate = Column(Float, default=0.0)
    net_worth_optimistic = Column(Float, default=0.0)
    tax_paid_est = Column(Float, default=0.0)
    notes = Column(String, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
