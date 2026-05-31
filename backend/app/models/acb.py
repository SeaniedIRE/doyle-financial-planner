from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class ACBTransaction(Base):
    __tablename__ = "acb_transactions"

    id = Column(Integer, primary_key=True, index=True)
    holding_id = Column(Integer, ForeignKey("holdings.id"), nullable=False)
    transaction_date = Column(DateTime, nullable=False)
    transaction_type = Column(String, nullable=False)  # buy / sell / reinvest / return_of_capital / split / spinoff
    quantity = Column(Float, nullable=False)
    price_per_share_cad = Column(Float, nullable=False)
    fees_cad = Column(Float, default=0.0)
    fx_rate = Column(Float, default=1.0)  # CAD/USD if applicable
    total_cost_cad = Column(Float, nullable=False)
    acb_per_share_after = Column(Float, default=0.0)
    total_acb_after = Column(Float, default=0.0)
    capital_gain_loss_cad = Column(Float, default=0.0)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    holding = relationship("Holding", back_populates="acb_transactions")
