from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from datetime import datetime, timezone
from ..database import Base


class Income(Base):
    __tablename__ = "income"

    id = Column(Integer, primary_key=True, index=True)
    person = Column(String, nullable=False)  # sean / saudya
    year = Column(Integer, nullable=False)
    employment_income = Column(Float, default=0.0)
    bonus = Column(Float, default=0.0)
    other_bonus = Column(Float, default=0.0)
    investment_income = Column(Float, default=0.0)
    rental_income = Column(Float, default=0.0)
    other_income = Column(Float, default=0.0)
    province = Column(String, default="ON")
    is_maternity_leave = Column(Boolean, default=False)
    maternity_ei_income = Column(Float, default=0.0)
    notes = Column(String, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
