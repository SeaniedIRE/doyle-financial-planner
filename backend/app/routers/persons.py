"""
Family Members API — manage Sean, Saudya, and future children.
GET  /api/persons/           — list all family members
POST /api/persons/           — add a family member
PUT  /api/persons/{id}       — update a family member
DELETE /api/persons/{id}     — remove a family member
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from ..database import get_db
from ..models.person import Person

router = APIRouter(prefix="/api/persons", tags=["persons"])


class PersonCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(default="adult", pattern="^(adult|child)$")
    date_of_birth: Optional[date] = None
    canada_resident_since_year: Optional[int] = None
    province: str = "ON"
    parent_id: Optional[int] = None


class PersonUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    role: Optional[str] = Field(None, pattern="^(adult|child)$")
    date_of_birth: Optional[date] = None
    canada_resident_since_year: Optional[int] = None
    province: Optional[str] = None
    parent_id: Optional[int] = None


@router.get("/")
def list_persons(db: Session = Depends(get_db)):
    persons = db.query(Person).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "role": p.role,
            "date_of_birth": p.date_of_birth,
            "canada_resident_since_year": p.canada_resident_since_year,
            "province": p.province,
            "parent_id": p.parent_id,
        }
        for p in persons
    ]


@router.post("/")
def create_person(body: PersonCreate, db: Session = Depends(get_db)):
    if body.parent_id:
        parent = db.query(Person).filter(Person.id == body.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent not found")
    person = Person(**body.model_dump())
    db.add(person)
    db.commit()
    db.refresh(person)
    return {"id": person.id, "name": person.name}


@router.put("/{person_id}")
def update_person(person_id: int, body: PersonUpdate, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(person, field, value)
    db.commit()
    db.refresh(person)
    return {"id": person.id, "name": person.name}


@router.delete("/{person_id}")
def delete_person(person_id: int, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    db.delete(person)
    db.commit()
    return {"deleted": person_id}
