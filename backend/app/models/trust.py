"""
Trust models — family trust and its held assets.
Supports cash, securities, and real estate held inside a family trust structure.
"""
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class FamilyTrust(Base):
    __tablename__ = "family_trusts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    trust_type = Column(String(50), nullable=False, default="discretionary")  # discretionary | alter_ego | spousal
    settled_date = Column(Date, nullable=True)
    trustee_names = Column(Text, nullable=True)
    beneficiary_names = Column(Text, nullable=True)
    province = Column(String(5), nullable=False, default="ON")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    assets = relationship("TrustAsset", back_populates="trust", cascade="all, delete-orphan")


class TrustAsset(Base):
    __tablename__ = "trust_assets"

    id = Column(Integer, primary_key=True, index=True)
    trust_id = Column(Integer, ForeignKey("family_trusts.id"), nullable=False)
    asset_type = Column(String(50), nullable=False)  # cash | security | real_estate | other
    name = Column(String(200), nullable=False)
    symbol = Column(String(20), nullable=True)
    quantity = Column(Float, nullable=True)
    book_value_cad = Column(Float, nullable=False, default=0.0)
    market_value_cad = Column(Float, nullable=False, default=0.0)
    acb_per_unit_cad = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    trust = relationship("FamilyTrust", back_populates="assets")
