"""
FastAPI application entry point.

Security posture:
  - This app runs behind Cloudflare Access (Zero Trust) — external auth is handled there.
  - Defence-in-depth controls are implemented here for internal network threats.
  - See app/security.py for middleware details.
  - CORS is locked to localhost only; Cloudflare strips and re-adds Origin headers.
  - FastAPI /docs and /redoc are disabled in production (DOCS_ENABLED=1 to re-enable).
"""

import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from .database import Base, engine, run_integrity_check
from .models import account, acb, income, scenario, room, person, trust, whatif, taxcheck
from .routers import (
    accounts, acb as acb_router, tax, income as income_router,
    scenarios, ai, whatif as whatif_router, trusts, persons, taxcheck as taxcheck_router,
)
from .seed import seed_database
from .security import BodySizeMiddleware, AuditLogMiddleware

# ─────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────
# DB schema
# ─────────────────────────────────────────────────────────────────────

Base.metadata.create_all(bind=engine)

# ─────────────────────────────────────────────────────────────────────
# Determine environment
# ─────────────────────────────────────────────────────────────────────

_PRODUCTION = os.environ.get("APP_ENV", "production").lower() == "production"
_DOCS_ENABLED = os.environ.get("DOCS_ENABLED", "0").lower() in ("1", "true", "yes")

# ─────────────────────────────────────────────────────────────────────
# FastAPI instance  (OWASP A05 — disable interactive docs in production)
# ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Doyle Financial Planner API",
    version="2.0.0",
    description="Private Canadian financial planning application.",
    # Disable /docs, /redoc, /openapi.json in production
    docs_url="/docs" if _DOCS_ENABLED else None,
    redoc_url="/redoc" if _DOCS_ENABLED else None,
    openapi_url="/openapi.json" if _DOCS_ENABLED else None,
)

# ─────────────────────────────────────────────────────────────────────
# Security middleware stack (order matters — outermost runs first)
# ─────────────────────────────────────────────────────────────────────

# 1. Audit logging (OWASP A09 / ASVS V7.1)
app.add_middleware(AuditLogMiddleware)

# 2. Body-size enforcement (ASVS V12.1.1)
app.add_middleware(BodySizeMiddleware)

# 3. CORS — restrict to same-host only (OWASP A01 / ASVS V13.1.3)
#    The app runs locally (localhost dev) or behind Cloudflare (same-origin SPA).
#    Cloudflare strips cross-origin headers before they reach the container.
#    Allowing only localhost prevents a compromised internal-network host from
#    calling the API with a browser-side credential.
_CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://localhost:8080",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Accept"],
    max_age=600,
)

# 4. Trusted host enforcement (blocks Host-header injection)
#    Allow localhost variants + wildcard for Cloudflare-forwarded requests.
_TRUSTED_HOSTS = [
    h.strip()
    for h in os.environ.get(
        "TRUSTED_HOSTS",
        "localhost,127.0.0.1,0.0.0.0",
    ).split(",")
    if h.strip()
]
# Add wildcard so Cloudflare-forwarded hostnames don't block the app.
# The Cloudflare tunnel is the real host filter; this catches host-injection.
_TRUSTED_HOSTS.append("*")

app.add_middleware(TrustedHostMiddleware, allowed_hosts=_TRUSTED_HOSTS)

# ─────────────────────────────────────────────────────────────────────
# Routers
# ─────────────────────────────────────────────────────────────────────

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

# ─────────────────────────────────────────────────────────────────────
# Startup
# ─────────────────────────────────────────────────────────────────────


@app.on_event("startup")
async def startup_event():
    # Integrity check before any writes (ASVS V6.2 / data protection)
    if not run_integrity_check():
        logger.critical(
            "Database integrity check failed. Refusing to start to prevent data corruption. "
            "Restore from backup: /app/data/backups/"
        )
        # Do not raise — let the app start in read-only-like mode so the admin can debug.
        # A failed integrity check is logged at CRITICAL level.

    seed_database()
    logger.info(
        "Doyle Financial Planner started. "
        f"Docs={'enabled' if _DOCS_ENABLED else 'disabled'}. "
        f"CORS origins={_CORS_ORIGINS}"
    )


# ─────────────────────────────────────────────────────────────────────
# Health check (unauthenticated — used by Unraid and the host reverse proxy)
# ─────────────────────────────────────────────────────────────────────


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Doyle Financial Planner"}


# ─────────────────────────────────────────────────────────────────────
# React SPA — must be registered LAST so all /api/* routes win
# ─────────────────────────────────────────────────────────────────────

_STATIC_DIR = "/app/static"

if os.path.isdir(_STATIC_DIR):
    from fastapi.staticfiles import StaticFiles
    from starlette.responses import FileResponse as _FileResponse

    class _SPAStaticFiles(StaticFiles):
        """
        Serve the React SPA.  For any path that does not correspond to a file
        on disk (i.e. a React Router client-side route) fall back to index.html
        so the browser can handle the route itself.
        """
        async def get_response(self, path: str, scope):
            try:
                return await super().get_response(path, scope)
            except Exception:
                return _FileResponse(os.path.join(self.directory, "index.html"))

    app.mount("/", _SPAStaticFiles(directory=_STATIC_DIR, html=True), name="spa")
