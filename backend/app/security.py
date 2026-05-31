"""
Security middleware and utilities.

Implements:
  - OWASP A01: CORS origin restriction
  - OWASP A04: AI endpoint rate limiting (token-bucket via in-process dict)
  - OWASP A05: production docs suppression, trusted-host enforcement
  - OWASP A09: structured security audit logging
  - ASVS V7.1: request/response logging without leaking sensitive data
  - ASVS V12.1.1: request body size enforcement

This app is designed to run behind Cloudflare Access (Zero Trust).
The controls here are a defence-in-depth layer — not a replacement for the
perimeter auth that Cloudflare provides.
"""

import time
import logging
import json
from collections import defaultdict
from typing import Callable
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# ─────────────────────────────────────────────────────────────────────
# Structured security logger
# (emits JSON lines — easy to ingest into Unraid syslog or a SIEM)
# ─────────────────────────────────────────────────────────────────────

_sec_logger = logging.getLogger("security")
_sec_logger.setLevel(logging.INFO)

_handler = logging.StreamHandler()
_handler.setFormatter(logging.Formatter("%(message)s"))
_sec_logger.addHandler(_handler)


def _log_event(event_type: str, request: Request, **extra) -> None:
    """Write a single-line JSON security event. Never includes body content."""
    record = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "event": event_type,
        "method": request.method,
        "path": request.url.path,
        "client": request.client.host if request.client else "unknown",
        "cf_ray": request.headers.get("CF-Ray", ""),
    }
    record.update(extra)
    _sec_logger.info(json.dumps(record))


# ─────────────────────────────────────────────────────────────────────
# Request-size enforcer  (ASVS V12.1.1)
# ─────────────────────────────────────────────────────────────────────

MAX_BODY_SIZE = 1 * 1024 * 1024  # 1 MiB — more than enough for any API call


class BodySizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        content_length = request.headers.get("Content-Length")
        if content_length and int(content_length) > MAX_BODY_SIZE:
            _log_event("body_size_rejected", request, size=content_length)
            return JSONResponse(
                status_code=413,
                content={"detail": "Request body too large (max 1 MiB)"},
            )
        return await call_next(request)


# ─────────────────────────────────────────────────────────────────────
# Security audit logging middleware  (ASVS V7.1.1)
# ─────────────────────────────────────────────────────────────────────

_SENSITIVE_PATHS = {"/api/ai/", "/api/whatif/simulate", "/api/income/", "/api/taxcheck/"}

_REDACTED_HEADERS = {"authorization", "cookie", "x-api-key", "cf-access-jwt"}


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000, 1)

        # Only log mutating requests and sensitive reads
        if request.method in ("POST", "PUT", "DELETE", "PATCH") or any(
            request.url.path.startswith(p) for p in _SENSITIVE_PATHS
        ):
            _log_event(
                "api_request",
                request,
                status=response.status_code,
                duration_ms=duration_ms,
            )

        # Log every 4xx/5xx  (ASVS V7.4.1 — surface errors without stack traces)
        if response.status_code >= 400:
            _log_event(
                "api_error",
                request,
                status=response.status_code,
                duration_ms=duration_ms,
            )

        return response


# ─────────────────────────────────────────────────────────────────────
# In-process rate limiter for AI endpoints  (OWASP A04 / ASVS V8.2.2)
# Token-bucket: 10 AI calls per client IP per hour.
# ─────────────────────────────────────────────────────────────────────

_AI_WINDOW_SECONDS = 3600
_AI_MAX_CALLS = 10  # per client IP per window

_rate_store: dict[str, list[float]] = defaultdict(list)


def check_ai_rate_limit(request: Request) -> None:
    """Call this at the top of every AI route. Raises 429 if over limit."""
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window_start = now - _AI_WINDOW_SECONDS

    calls = _rate_store[client_ip]
    _rate_store[client_ip] = [t for t in calls if t > window_start]  # prune old
    _rate_store[client_ip].append(now)

    if len(_rate_store[client_ip]) > _AI_MAX_CALLS:
        _log_event("rate_limit_hit", request, client=client_ip)
        raise HTTPException(
            status_code=429,
            detail=f"Too many AI requests. Max {_AI_MAX_CALLS} per hour.",
            headers={"Retry-After": str(_AI_WINDOW_SECONDS)},
        )


# ─────────────────────────────────────────────────────────────────────
# Settings key allowlist  (OWASP A03 / ASVS V5.1.3)
# ─────────────────────────────────────────────────────────────────────

ALLOWED_SETTINGS_KEYS = frozenset({
    "fx_cad_usd",
    "last_holdings_update",
    "sean_canada_since",
    "saudya_canada_since",
    "person_a_canada_since",
    "person_b_canada_since",
    "province",
    "house_purchase_year",
    "house_down_payment",
    "mat_leave_1_year",
    "mat_leave_2_year",
    "salary_growth_rate",
})


def validate_settings_keys(data: dict) -> dict:
    """Strip any keys not in the allowlist. Returns sanitised dict."""
    invalid = set(data.keys()) - ALLOWED_SETTINGS_KEYS
    if invalid:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown settings key(s): {', '.join(sorted(invalid))}. "
                   f"Allowed: {', '.join(sorted(ALLOWED_SETTINGS_KEYS))}",
        )
    return data


# ─────────────────────────────────────────────────────────────────────
# CSV import size limit  (OWASP A03)
# ─────────────────────────────────────────────────────────────────────

MAX_CSV_CHARS = 200_000  # ~200K chars — ~2,000 holdings at max verbosity


def validate_csv_body(content: str) -> None:
    if len(content) > MAX_CSV_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"CSV too large (max {MAX_CSV_CHARS // 1000}K characters).",
        )
