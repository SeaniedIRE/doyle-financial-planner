"""
What-if simulation model — stores user-defined one-off scenario tweaks.
e.g. "What if we added $100,000 to Sean's TFSA today?"
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from datetime import datetime, timezone
from ..database import Base


class WhatIfSimulation(Base):
    __tablename__ = "whatif_simulations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Overrides — any field left None uses the baseline scenario value
    override_sean_tfsa = Column(Float, nullable=True)
    override_saudya_tfsa = Column(Float, nullable=True)
    override_sean_rrsp = Column(Float, nullable=True)
    override_saudya_rrsp = Column(Float, nullable=True)
    override_sean_fhsa = Column(Float, nullable=True)
    override_saudya_fhsa = Column(Float, nullable=True)
    override_sean_margin = Column(Float, nullable=True)
    override_saudya_margin = Column(Float, nullable=True)
    override_sean_base = Column(Float, nullable=True)
    override_saudya_base = Column(Float, nullable=True)
    override_house_purchase_year = Column(Integer, nullable=True)
    override_house_down_payment = Column(Float, nullable=True)

    # Stored results (JSON)
    result_json = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_saved = Column(Boolean, default=False)
