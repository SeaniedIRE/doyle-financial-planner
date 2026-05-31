from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .models import account, acb, income, scenario, room, person, trust, whatif, taxcheck
from .routers import (
    accounts, acb as acb_router, tax, income as income_router,
    scenarios, ai, whatif as whatif_router, trusts, persons, taxcheck as taxcheck_router,
)
from .seed import seed_database

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Doyle Financial Planner API",
    version="2.0.0",
    description="Private Canadian financial planning application.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(acb_router.router)
app.include_router(tax.router)
app.include_router(income_router.router)
app.include_router(scenarios.router)
app.include_router(ai.router)
app.include_router(whatif_router.router)
app.include_router(trusts.router)
app.include_router(persons.router)
app.include_router(taxcheck_router.router)


@app.on_event("startup")
async def startup_event():
    seed_database()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Doyle Financial Planner"}
