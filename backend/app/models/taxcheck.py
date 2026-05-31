"""
TaxYearCheck model — tracks annual CRA rule verification.
The app surfaces a banner each January prompting the user to confirm that
TFSA limits, tax brackets, and RRSP caps are still accurate for the new year.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from datetime import datetime, timezone
from ..database import Base


class TaxYearCheck(Base):
    __tablename__ = "tax_year_checks"

    id = Column(Integer, primary_key=True, index=True)
    tax_year = Column(Integer, nullable=False, unique=True)
    confirmed_by = Column(String(100), nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    tfsa_limit_verified = Column(Boolean, default=False)
    rrsp_limit_verified = Column(Boolean, default=False)
    federal_brackets_verified = Column(Boolean, default=False)
    ontario_brackets_verified = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def fully_verified(self) -> bool:
        return all([
            self.tfsa_limit_verified,
            self.rrsp_limit_verified,
            self.federal_brackets_verified,
            self.ontario_brackets_verified,
        ])
