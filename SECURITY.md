# Security Controls — Doyle Financial Planner

**Standard:** OWASP Top 10 (2021) + OWASP ASVS Level 2  
**Last reviewed:** 2026-05-30  
**Threat model:** Single-user private financial application, self-hosted on Unraid behind Cloudflare Access Zero Trust. Attacker profile: internet adversary (blocked by Cloudflare), compromised internal host, or a friend given access to the open-source repo (no personal data in code).

---

## Architecture overview

```
Internet → Cloudflare Access (ZT auth) → Cloudflare Tunnel
         → nginx (TLS termination, headers)
         → uvicorn / FastAPI (business logic)
         → SQLite WAL (data)
```

Two independent security perimeters:
1. **Cloudflare Access** — Zero Trust, handles authentication for all external requests.
2. **Application layer** — defence-in-depth for internal-network and supply-chain threats.

---

## OWASP Top 10 (2021) mapping

| # | Risk | Control | File |
|---|------|---------|------|
| A01 | Broken Access Control | CORS locked to `localhost` variants only; Cloudflare Access guards all external entry points | `main.py`, `.env.example` |
| A02 | Cryptographic Failures | SQLite stored in plaintext — **host filesystem must be encrypted** (documented in README and `.env.example`). No passwords stored; no secrets in code (`.env` excluded via `.gitignore`) | `database.py`, `.env.example` |
| A03 | Injection | All DB access via SQLAlchemy ORM (parameterised queries only). Settings endpoint key-whitelisted (`ALLOWED_SETTINGS_KEYS`). CSV import size-capped and validated. Pydantic input validation on every request body | `security.py`, `routers/accounts.py` |
| A04 | Insecure Design | Token-bucket rate limiter on all AI endpoints (10 req / IP / hour). Body-size middleware (1 MiB hard limit) prevents resource exhaustion | `security.py` |
| A05 | Security Misconfiguration | `/docs`, `/redoc`, `/openapi.json` **disabled in production** (`DOCS_ENABLED=0` default). `server_tokens off` in nginx. No debug mode in production | `main.py`, `nginx/app.conf` |
| A06 | Vulnerable Components | Dependabot configured for pip, npm, and GitHub Actions — weekly scans, Monday 09:00 ET, PRs auto-labelled `security` | `.github/dependabot.yml` |
| A07 | Identification & Auth Failures | Authentication delegated to Cloudflare Access (ZT). Application has no password store to misconfigure. Cloudflare Access JWT header forwarded for audit correlation | `nginx/app.conf` |
| A08 | Software & Data Integrity | GitHub Actions CI validates TypeScript + runs 82-test Python suite before any image is built and pushed to GHCR. Alembic migrations are additive-only (no DROP) | `.github/workflows/`, `alembic/versions/` |
| A09 | Security Logging & Monitoring | Structured JSON audit log middleware logs every mutating request (method, path, client IP, response status, duration). Critical startup alert if DB integrity check fails | `security.py` (`AuditLogMiddleware`) |
| A10 | SSRF | No outbound HTTP from the application except to the Anthropic API (single hard-coded endpoint). No user-controlled URLs accepted | `routers/ai.py` |

---

## ASVS Level 2 controls

### V1 — Architecture

| Req | Control |
|-----|---------|
| V1.1.1 | Threat model documented above; single-container image, minimal attack surface |
| V1.9.1 | API runs on internal port 8000; only nginx (port 80) is exposed on the host |

### V5 — Validation, Sanitisation and Encoding

| Req | Control |
|-----|---------|
| V5.1.1 | All API request bodies validated by Pydantic models before any business logic runs |
| V5.1.3 | Settings endpoint enforces a closed whitelist (`ALLOWED_SETTINGS_KEYS`); unknown keys → HTTP 400 |
| V5.1.4 | CSV import: Pydantic `max_length=200_000` + explicit `validate_csv_body()` content-length check |

### V6 — Stored Cryptography

| Req | Control |
|-----|---------|
| V6.2 | SQLite WAL mode: crash-consistent writes, allows hot backup. `PRAGMA integrity_check` runs at startup; CRITICAL log if check fails. **Data at rest confidentiality is the responsibility of the host filesystem encryption** (documented) |
| V6.2.1 | No custom cryptography implemented. Cloudflare TLS (TLS 1.2+ minimum) handles data in transit |

### V7 — Error Handling and Logging

| Req | Control |
|-----|---------|
| V7.1.1 | `AuditLogMiddleware` emits structured JSON for every mutation and every 4xx/5xx response |
| V7.1.2 | Audit log includes: timestamp, HTTP method, path, client IP (from `X-Forwarded-For`), response status, duration ms |
| V7.2.1 | FastAPI default exception handlers return generic error messages; no stack traces in production |

### V12 — File and Resource Upload

| Req | Control |
|-----|---------|
| V12.1.1 | `BodySizeMiddleware`: requests > 1 MiB → HTTP 413 before body is read. nginx: `client_max_body_size 2m` |

### V13 — API and Web Service

| Req | Control |
|-----|---------|
| V13.1.3 | CORS origin list read from `CORS_ALLOWED_ORIGINS` env var; default is `localhost` only; `allow_credentials=False` |
| V13.2.1 | All write endpoints use `POST` / `PUT` / `DELETE`; `GET` endpoints are read-only with no side effects |

---

## HTTP security headers (nginx)

| Header | Value | Rationale |
|--------|-------|-----------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; ...` | Blocks inline scripts and cross-origin resource loads |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `Referrer-Policy` | `no-referrer` | No referrer leakage |
| `Permissions-Policy` | camera, mic, geolocation, payment all `()` | Locks down browser APIs |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HSTS — forces HTTPS once seen |
| `server_tokens` | `off` | Hides nginx version |

`X-XSS-Protection` is intentionally omitted — it is deprecated and can introduce vulnerabilities in old browsers; CSP supersedes it.

---

## Data protection

### Confidentiality

- **No personal financial data in the codebase.** Seed data uses $0 placeholder values with `PLACEHOLDER` account numbers.  
- **No secrets committed.** `.env` is in `.gitignore`; `.env.example` contains only placeholder values.
- **Cloudflare Access** provides Zero Trust authentication for external access. Access policies enforce MFA.
- **SQLite is stored in plaintext.** The `/app/data` volume **must** be on an encrypted Unraid share or an encrypted host filesystem. This is documented in `README.md` and `.env.example`.

### Integrity

- **WAL mode** (`PRAGMA journal_mode=WAL`) — crash-consistent writes. The database is never left in a partial-write state.
- **Foreign keys enforced** (`PRAGMA foreign_keys=ON`) — referential integrity at the DB layer.
- **Startup integrity check** — `PRAGMA integrity_check` runs before any application logic. CRITICAL log entry if check fails; application continues in a degraded/read-only mode to allow admin investigation.
- **Alembic additive-only migrations** — `downgrade()` is a no-op by policy. No columns are ever dropped.
- **Backup script** (`scripts/backup.sh`) — timestamped `.db` snapshots, last 30 retained.

### Availability

- **SQLite WAL** allows concurrent reads without blocking writes.
- **`pool_pre_ping=True`** — stale connections detected and recycled before use.
- **Supervisord** inside the container restarts nginx or uvicorn on crash.

---

## Known limitations / accepted risks

| Risk | Rationale for acceptance |
|------|--------------------------|
| SQLite plaintext at rest | Host-level encryption documented and required. SQLCipher would add complexity and remove standard tooling. |
| In-process rate limiter | No Redis dependency — simpler for single-container Unraid install. Resets on container restart. Acceptable for a private, single-user app. |
| No application-level session tokens | Delegated to Cloudflare Access; this is intentional, not an oversight. |
| `TRUSTED_HOSTS` includes `"*"` wildcard | Required because Cloudflare forwards arbitrary tunnel hostnames. The real host filter is Cloudflare's own tunnel. |

---

## Supply chain

- **Dependabot** scans pip, npm, and GitHub Actions dependencies weekly.
- **GitHub Actions CI** must pass (TypeScript + 82 Python tests) before any Docker image is pushed to GHCR.
- **Pinned base images** in `Dockerfile` should be reviewed quarterly.

---

## Reporting security issues

This is a private repository. Contact the owner directly via GitHub private message or email. Do not open public issues for security vulnerabilities.
