"""
Person model — supports Sean, Saudya, and future children.
parent_id allows linking children to their parents.
"""
from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base


class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, default="adult")  # adult | child
    date_of_birth = Column(Date, nullable=True)
    canada_resident_since_year = Column(Integer, nullable=True)
    province = Column(String(5), nullable=False, default="ON")
    parent_id = Column(Integer, ForeignKey("persons.id"), nullable=True)

    children = relationship("Person", back_populates="parent", foreign_keys=[parent_id])
    parent = relationship("Person", back_populates="children", foreign_keys=[parent_id], remote_side=[id])
