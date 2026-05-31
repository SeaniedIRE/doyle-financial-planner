from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from ..database import Base


class Owner(str, enum.Enum):
    sean = "sean"
    saudya = "saudya"
    joint = "joint"


class AccountType(str, enum.Enum):
    tfsa = "TFSA"
    rrsp = "RRSP"
    fhsa = "FHSA"
    lira = "LIRA"
    margin = "Margin"
    cash = "Cash"
    joint_non_reg = "Joint Non-Reg"
    resp = "RESP"
    other = "Other"


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    account_type = Column(String, nullable=False)
    owner = Column(String, nullable=False)  # sean / saudya / joint
    account_number = Column(String, unique=True, nullable=False)
    currency = Column(String, default="CAD")
    margin_loan_cad = Column(Float, default=0.0)
    margin_rate_pct = Column(Float, default=3.95)
    # Broker-reported margin figures (updated manually from the broker dashboard)
    margin_buying_power_cad  = Column(Float, nullable=True)   # max buying power
    margin_available_cad     = Column(Float, nullable=True)   # available to withdraw
    margin_requirement_cad   = Column(Float, nullable=True)   # maintenance requirement
    is_active = Column(Boolean, default=True)
    notes = Column(String, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    holdings = relationship("Holding", back_populates="account", cascade="all, delete-orphan")


class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    symbol = Column(String, nullable=False)
    exchange = Column(String, default="TSX")
    name = Column(String, nullable=False)
    security_type = Column(String, default="ETF")
    quantity = Column(Float, default=0.0)
    book_value_cad = Column(Float, default=0.0)
    current_price = Column(Float, default=0.0)
    price_currency = Column(String, default="CAD")
    market_value_cad = Column(Float, default=0.0)
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)
    notes = Column(String, default="")

    account = relationship("Account", back_populates="holdings")
    acb_transactions = relationship("ACBTransaction", back_populates="holding", cascade="all, delete-orphan")


class AppSettings(Base):
    """Key-value store for app-wide settings (FX rates, etc.)"""
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(String, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
