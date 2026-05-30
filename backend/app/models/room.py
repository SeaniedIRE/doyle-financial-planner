from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime, timezone
from ..database import Base


class ContributionRoom(Base):
    __tablename__ = "contribution_room"

    id = Column(Integer, primary_key=True, index=True)
    person = Column(String, nullable=False)
    account_type = Column(String, nullable=False)  # TFSA / RRSP / FHSA
    year = Column(Integer, nullable=False)
    room_available = Column(Float, default=0.0)
    contributed_ytd = Column(Float, default=0.0)
    withdrawn_ytd = Column(Float, default=0.0)  # TFSA withdrawals re-added next year
    notes = Column(String, default="")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
