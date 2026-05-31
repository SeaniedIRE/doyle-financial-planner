# CLAUDE.md — Doyle Financial Planner
## Complete Technical Reference for AI-Assisted Development

> This file is the authoritative guide for any Claude session working on this codebase.
> Read this before touching any file. Every significant decision is explained here.

---

## 1. Application Purpose

A private, self-hosted Canadian financial planning application for the Doyle family.
Primary users: two adults + up to 3 children as they grow. Designed to run for **40+ years**.
Deployed as a single Docker container on an Unraid home server, accessed via Cloudflare Zero Trust.

---

## 2. Architecture — Single All-In-One Docker Image

```
Browser (HTTPS via Cloudflare Tunnel)
  → Unraid host :8080
    → nginx :80 (inside container)
      → /           → React SPA static files at /app/static
      → /api/       → uvicorn (FastAPI) on 127.0.0.1:8000
      → /health     → nginx 200 (for Unraid health checks)
```

**Why single container?**
Unraid's Docker UI manages individual containers. A single image means one-click install from
GHCR, one "Check for Updates" button, one volume to back up. Simpler = more reliable over 40 years.

**Processes inside the container (supervisord):**
- `nginx` — serves static files, proxies /api
- `uvicorn` — FastAPI backend on 127.0.0.1:8000

---

## 3. Complete File Tree

```
doyle-financial-planner/
├── CLAUDE.md                        ← YOU ARE HERE
├── Dockerfile                       ← All-in-one image (nginx + backend + React)
├── supervisord.conf                 ← Process manager config inside container
├── docker-compose.yml               ← Local development (Mac) - builds from source
├── docker-compose.prod.yml          ← Unraid production - pulls from GHCR
├── .env.example                     ← Environment variable template
├── .gitignore                       ← Never commits .env, data/, *.db
│
├── .github/
│   └── workflows/
│       ├── ci.yml                   ← Runs tests on every PR and push
│       └── build-push.yml           ← Builds image, pushes to GHCR on main merge
│
├── nginx/
│   └── app.conf                     ← nginx config for all-in-one container
│
├── unraid/
│   └── doyle-financial-planner.xml  ← Unraid Community Apps XML template
│
├── scripts/
│   ├── backup.sh                    ← Manual or cron DB backup
│   └── update.sh                   ← Pull latest image + restart (run on Unraid)
│
├── backend/
│   ├── requirements.txt             ← Python dependencies (FastAPI, SQLAlchemy, etc.)
│   ├── Dockerfile                   ← Backend-only Dockerfile (used by all-in-one)
│   │
│   ├── alembic.ini                  ← Alembic migration config
│   ├── alembic/
│   │   ├── env.py                   ← Migration environment (reads DATABASE_URL from .env)
│   │   └── versions/                ← One file per migration — NEVER edit old ones
│   │       └── 001_initial_schema.py
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  ← FastAPI app, CORS, router registration, startup
│   │   ├── database.py              ← SQLAlchemy engine + session + get_db dependency
│   │   ├── config.py                ← Settings loaded from environment variables
│   │   ├── seed.py                  ← First-run seed: creates default scenarios ONLY
│   │   │                              ← NO personal data — all entered via UI/CSV
│   │   │
│   │   ├── models/                  ← SQLAlchemy ORM models (one file per domain)
│   │   │   ├── __init__.py
│   │   │   ├── account.py           ← Account, Holding, AppSettings
│   │   │   ├── acb.py               ← ACBTransaction
│   │   │   ├── income.py            ← Income (by person, by year)
│   │   │   ├── scenario.py          ← Scenario, ForecastEntry
│   │   │   ├── room.py              ← ContributionRoom (TFSA/RRSP/FHSA)
│   │   │   ├── person.py            ← Person (family members, children)
│   │   │   ├── trust.py             ← Trust, TrustAsset
│   │   │   ├── whatif.py            ← WhatIfSimulation
│   │   │   └── taxcheck.py          ← TaxYearCheck (annual CRA rule verification)
│   │   │
│   │   ├── routers/                 ← FastAPI routers (one per domain)
│   │   │   ├── accounts.py          ← GET/POST/PUT/DELETE accounts + holdings
│   │   │   ├── acb.py               ← ACB history, transactions, loss harvest
│   │   │   ├── tax.py               ← Tax calculations, contribution room
│   │   │   ├── income.py            ← Income CRUD
│   │   │   ├── scenarios.py         ← Scenarios + forecast runner
│   │   │   ├── ai.py                ← Claude API endpoints
│   │   │   ├── persons.py           ← Family member management
│   │   │   ├── trusts.py            ← Trust + trust asset management
│   │   │   ├── whatif.py            ← What-if simulation runner
│   │   │   └── taxcheck.py          ← Annual tax year check + CRA links
│   │   │
│   │   └── services/                ← Business logic (pure functions, no DB)
│   │       ├── tax_engine.py        ← CRA tax calculations (see §7 for rules)
│   │       ├── acb_calculator.py    ← ACB math + loss harvesting
│   │       ├── forecast_engine.py   ← Compound growth projections
│   │       └── claude_service.py    ← Anthropic API integration
│   │
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py              ← pytest fixtures (in-memory SQLite test DB)
│       ├── test_tax_engine.py       ← CRA formula verification tests
│       ├── test_acb_calculator.py   ← ACB calculation tests
│       └── test_forecast_engine.py  ← Forecast math tests
│
└── frontend/
    ├── Dockerfile                   ← Frontend-only Dockerfile (multi-stage)
    ├── nginx-frontend.conf          ← nginx config for standalone frontend container
    ├── index.html
    ├── package.json
    ├── vite.config.ts               ← Dev: proxies /api to localhost:8000
    ├── tsconfig.json
    ├── tailwind.config.js
    ├── postcss.config.js
    │
    └── src/
        ├── main.tsx                 ← React entry point, QueryClient setup
        ├── App.tsx                  ← Router with all routes
        ├── index.css                ← Tailwind + custom CSS classes
        │
        ├── api/                     ← Axios API functions (one file per domain)
        │   ├── client.ts            ← Axios instance, fmt(), fmtPct() helpers
        │   ├── accounts.ts
        │   ├── tax.ts
        │   ├── scenarios.ts
        │   └── ai.ts
        │
        ├── types/
        │   └── index.ts             ← All TypeScript interfaces matching backend models
        │
        ├── components/
        │   ├── layout/
        │   │   ├── Sidebar.tsx      ← Left navigation
        │   │   └── Layout.tsx       ← Outlet wrapper
        │   ├── charts/
        │   │   └── NetWorthChart.tsx ← Recharts area chart
        │   └── ui/
        │       ├── StatCard.tsx      ← KPI metric card
        │       ├── Badge.tsx         ← Account type badge (colour-coded)
        │       ├── TaxYearBanner.tsx ← Annual CRA update reminder banner
        │       ├── CRALinks.tsx      ← CRA reference links panel
        │       └── ValidationMessage.tsx ← Inline validation error display
        │
        └── pages/                   ← One file per page/route
            ├── Dashboard.tsx        ← Portfolio overview, action items
            ├── Holdings.tsx         ← All accounts + holdings, inline edit
            ├── ACBTracker.tsx       ← ACB history, loss harvest analysis
            ├── TaxPlanning.tsx      ← Federal + Ontario tax calculator
            ├── Income.tsx           ← Income by year, by person
            ├── Scenarios.tsx        ← Create/manage scenarios
            ├── Forecasts.tsx        ← Run and view projections
            ├── WhatIf.tsx           ← What-if simulator ("what if +$100K here?")
            ├── HousePlanning.tsx    ← FHSA + HBP strategy
            ├── MaternityPlanning.tsx ← Mat leave impact modeling
            ├── TrustAccounts.tsx    ← Family trust management
            ├── FamilyMembers.tsx    ← Person/child management
            ├── AIAdvisor.tsx        ← Claude AI question interface
            └── Settings.tsx         ← App settings, CSV import, backup
```

---

## 4. Database Schema (SQLite via SQLAlchemy)

**Database file location inside container:** `/app/data/financial_planner.db`
**Host volume mount:** configured in Unraid Docker settings (e.g. `/mnt/user/appdata/doyle-financial-planner/data`)

### Why SQLite (not PostgreSQL)?
For a single-family app accessed by 2-3 people simultaneously, SQLite with WAL mode is
perfectly adequate. Benefits: zero administration, single file = simple backup, no separate
container, works identically in production and dev. Revisit if concurrent writes cause issues.

### persons
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| name | String | Display name e.g. "Sean" |
| slug | String UNIQUE | e.g. "sean" — used as FK reference in other tables |
| date_of_birth | Date | Used to calculate age-based rules |
| canada_resident_since | Integer | Year — for TFSA room calculation |
| province | String | Default "ON" — for provincial tax |
| is_primary | Boolean | Head of household flag |
| parent_id | Integer FK→persons.id | NULL for adults, set for children |
| notes | Text | |

### accounts
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| name | String | Display name |
| account_type | String | TFSA/RRSP/FHSA/LIRA/Margin/Cash/Joint Non-Reg/RESP/Trust |
| owner | String | person slug or "joint" |
| person_id | Integer FK→persons.id | NULL = joint/unassigned |
| account_number | String UNIQUE | Broker account number |
| currency | String | CAD default |
| margin_loan_cad | Float | Amount borrowed on margin |
| margin_rate_pct | Float | Current margin interest rate |
| trust_id | Integer FK→trusts.id | If held in a trust |
| is_active | Boolean | Soft delete |
| notes | String | |

### holdings
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| account_id | Integer FK→accounts.id | |
| symbol | String | Ticker symbol e.g. "VFV" |
| exchange | String | e.g. "TSX" |
| name | String | Full security name |
| security_type | String | ETF/Equity/Bond/GIC/Cash/Other |
| quantity | Float | Number of units/shares |
| book_value_cad | Float | Total ACB (cost basis) in CAD |
| current_price | Float | Price per unit in price_currency |
| price_currency | String | CAD or USD |
| market_value_cad | Float | quantity × price × fx_rate |
| last_updated | DateTime | When price was last refreshed |
| is_active | Boolean | Soft delete |
| notes | String | e.g. USD position warnings |

### acb_transactions
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| holding_id | Integer FK→holdings.id | |
| transaction_date | DateTime | |
| transaction_type | String | buy/sell/reinvest/return_of_capital/split/spinoff |
| quantity | Float | Units bought/sold |
| price_per_share_cad | Float | Per-unit price in CAD |
| fees_cad | Float | Commission/fees |
| fx_rate | Float | CAD/USD if applicable |
| total_cost_cad | Float | Computed: qty × price + fees |
| acb_per_share_after | Float | Computed ACB after this transaction |
| total_acb_after | Float | Running total ACB |
| capital_gain_loss_cad | Float | Only on sells |
| superficial_loss_flag | Boolean | True if loss may be denied (ITA s.54) |
| notes | Text | |

### income
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| person | String | Person slug |
| year | Integer | Tax year |
| employment_income | Float | T4 Box 14 |
| bonus | Float | Included in T4 |
| other_bonus | Float | Any additional discretionary |
| investment_income | Float | Interest, dividends (non-registered) |
| rental_income | Float | |
| other_income | Float | |
| province | String | Provincial tax jurisdiction |
| is_maternity_leave | Boolean | |
| maternity_ei_income | Float | EI benefits (taxable) |
| notes | String | |

### scenarios
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| name | String | User-given name |
| description | Text | |
| is_baseline | Boolean | One scenario should be baseline |
| growth_conservative_pct | Float | Default 5.0 |
| growth_moderate_pct | Float | Default 7.0 |
| growth_optimistic_pct | Float | Default 10.0 |
| house_purchase_year | Integer | |
| house_price_cad | Float | |
| house_down_payment_cad | Float | |
| assumptions | JSON | Extensible key-value store |

### trusts
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| name | String | e.g. "Doyle Family Trust" |
| trust_type | String | family_discretionary/testamentary/alter_ego/spousal/bare |
| province | String | Jurisdiction |
| fiscal_year_end | String | MM-DD, e.g. "12-31" (can be non-calendar) |
| tax_rate_pct | Float | Flat top rate for trusts in Canada (ITA s.122) |
| trustee_names | JSON | List of trustee names |
| beneficiary_names | JSON | List of beneficiary names |
| settled_date | Date | When trust was created |
| notes | Text | |
| is_active | Boolean | |

### trust_assets
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| trust_id | Integer FK→trusts.id | |
| asset_type | String | cash/account/real_estate/other |
| description | String | |
| value_cad | Float | Current value |
| acb_cad | Float | Adjusted cost base |
| notes | Text | |

### whatif_simulations
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| name | String | e.g. "What if +$100K to RRSP?" |
| description | Text | |
| scenario_id | Integer FK→scenarios.id | Base scenario to modify |
| account_changes | JSON | [{account_id, delta_cad}] |
| income_changes | JSON | [{person, year, delta_cad}] |
| rate_changes | JSON | [{key, value}] e.g. margin rate |
| result_snapshot | JSON | Stores last run result |
| created_at | DateTime | |

### tax_year_checks
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| tax_year | Integer UNIQUE | Calendar year |
| tfsa_limit | Integer | Confirmed TFSA annual limit |
| rrsp_limit | Integer | Confirmed RRSP annual limit |
| fhsa_limit | Integer | Always $8,000 unless CRA changes |
| capital_gains_inclusion_pct | Float | 50.0 in 2026 |
| federal_basic_personal | Integer | Basic personal amount |
| ei_max_insurable | Integer | EI insurable earnings ceiling |
| checked_at | DateTime | When user confirmed |
| cra_verified | Boolean | User confirmed against CRA website |
| notes | Text | User's notes about this year's changes |

### contribution_room
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| person | String | Person slug |
| account_type | String | TFSA/RRSP/FHSA |
| year | Integer | |
| room_available | Float | As of start of year |
| contributed_ytd | Float | Contributions made so far |
| withdrawn_ytd | Float | TFSA withdrawals (re-added next year) |
| notes | String | |

### app_settings
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| key | String UNIQUE | Setting key |
| value | String | Setting value |
| updated_at | DateTime | |

---

## 5. API Endpoints

All routes prefixed with `/api`. Responses are JSON.

### Accounts (`/api/accounts`)
- `GET /` — list all accounts with totals
- `POST /` — create account
- `PUT /{id}` — update account
- `DELETE /{id}` — soft delete
- `GET /{id}/holdings` — list holdings for account
- `POST /holdings` — create holding
- `PUT /holdings/{id}` — update holding (price, qty, book value)
- `DELETE /holdings/{id}` — soft delete holding
- `GET /summary/totals` — portfolio totals by owner/account type
- `POST /holdings/import-csv` — bulk update from broker CSV string
- `GET /settings` — app settings key-value
- `PUT /settings` — update settings

### ACB (`/api/acb`)
- `GET /{holding_id}/history` — full ACB transaction history with running totals
- `GET /{holding_id}/summary` — current ACB summary (shares, ACB/share, total ACB)
- `POST /transaction` — add a transaction
- `DELETE /transaction/{id}` — remove transaction
- `GET /loss-harvest/analysis` — analyse all non-registered holdings for loss opportunities

### Tax (`/api/tax`)
- `POST /calculate` — full federal + Ontario tax calculation
- `GET /comparison/{year}` — Sean vs Saudya side-by-side
- `GET /contribution-room/{person}/{year}` — TFSA/RRSP/FHSA room info
- `GET /maternity-ei/{year}` — EI benefit estimate

### Income (`/api/income`)
- `GET /` — all income records
- `GET /{person}` — by person
- `POST /` — create
- `PUT /{id}` — update
- `DELETE /{id}` — delete

### Scenarios (`/api/scenarios`)
- `GET /` — list scenarios
- `POST /` — create
- `PUT /{id}` — update
- `DELETE /{id}` — soft delete
- `POST /{id}/run` — run forecast, returns ForecastSnapshot[]

### What-If (`/api/whatif`)
- `GET /` — list saved simulations
- `POST /` — create/save simulation
- `PUT /{id}` — update
- `DELETE /{id}` — delete
- `POST /run` — run a transient what-if (not saved)
- `POST /{id}/run` — run a saved simulation

### AI (`/api/ai`)
- `POST /ask` — free-form question with optional portfolio context
- `POST /validate-strategy` — validate a named strategy
- `POST /loss-harvest-advice/{holding_id}` — PSNY or other loss analysis
- `GET /fhsa-strategy` — FHSA + HBP withdrawal plan
- `GET /annual-review/{year}` — year-end checklist

### Persons (`/api/persons`)
- `GET /` — list family members
- `POST /` — add family member
- `PUT /{id}` — update
- `DELETE /{id}` — soft delete

### Trusts (`/api/trusts`)
- `GET /` — list trusts
- `POST /` — create trust
- `PUT /{id}` — update
- `GET /{id}/assets` — list trust assets
- `POST /{id}/assets` — add asset

### Tax Year Check (`/api/taxcheck`)
- `GET /current` — check for current year + alert status
- `GET /{year}` — get check for specific year
- `POST /confirm/{year}` — user confirms they've reviewed CRA for this year
- `GET /cra-links` — returns current CRA reference URLs

---

## 6. CRA Tax Rules Implemented

All rules are in `backend/app/services/tax_engine.py`.

### Federal Tax 2026 (ITA Part I)
Brackets (applied after basic personal amount of $15,705):
- 15% on first $57,375
- 20.5% on next $57,375
- 26% on next $63,776
- 29% on next $70,245
- 33% on remainder

### Ontario Provincial Tax 2026
Brackets (after basic personal amount of $11,865):
- 5.05% on first $51,446
- 9.15% on next $51,448
- 11.16% on next $47,728
- 12.16% on next $70,000
- 13.16% on remainder

### Capital Gains (ITA s.38)
- **50% inclusion rate** in 2026
- Only 50% of net capital gain is included in income
- Losses can offset gains; excess carries back 3 years or forward indefinitely
- ACB tracked per security, per account

### Superficial Loss Rule (ITA s.54)
- Loss is denied if identical security repurchased within 30 days before OR after the sale
- App flags potential superficial losses but does not auto-block (user must confirm)

### RRSP (ITA s.146)
- Contribution room = 18% of prior year earned income, capped at annual limit
- 2026 limit: $32,490
- Unused room carries forward indefinitely
- Spousal RRSP: contributor claims deduction, account grows in spouse's name

### TFSA (ITA s.146.2)
- Annual limits tracked in `TFSA_LIMITS` dict in tax_engine.py
- Room accumulates from the year a person becomes a Canadian resident
- **Note for Sean**: resident since 2018, NOT 2009 — total room differs significantly
- Withdrawals re-added to room in the following calendar year

### FHSA (ITA s.146.6)
- $8,000/year, $40,000 lifetime contribution limit
- Max 1 year carryforward of unused room
- Contributions are deductible (like RRSP)
- Qualifying withdrawal: tax-free for first home purchase
- Account must be open ≥1 calendar year before qualifying withdrawal
- Unused balance can transfer to RRSP tax-free if home not purchased

### Margin Interest Deduction (ITA s.20(1)(c))
- Interest on money borrowed to earn investment income is deductible
- Must be for income-producing non-registered investments
- TFSA/RRSP borrowing does not qualify

### EI Maternity/Parental Benefits
- Standard: 55% of average insurable earnings, capped at max insurable earnings ceiling
- Extended parental: 33% for up to 69 weeks
- EI benefits are taxable income
- Clawback if net income exceeds ~$76,875

### Trust Taxation (ITA s.104-107)
- Family discretionary trusts: taxed at top marginal rate (~33% federal + provincial)
- Testamentary trusts: graduated rate estate in first 36 months, then top rate
- 21-year deemed disposition rule: trust must report accrued gains every 21 years
- Income can be allocated to beneficiaries at their marginal rates (income splitting)

---

## 7. How to Add a New Feature

### Adding a new backend model
1. Create `backend/app/models/mymodel.py` — follow existing patterns exactly
2. Import it in `backend/app/models/__init__.py`
3. Import it in `backend/app/main.py` (the metadata.create_all import path)
4. Create a migration: `cd backend && alembic revision --autogenerate -m "add mymodel"`
5. Review the generated migration in `alembic/versions/` — never auto-apply without reviewing
6. Migrations run automatically on container startup via `alembic upgrade head` in startup event

### Adding a new API router
1. Create `backend/app/routers/myrouter.py`
2. Add `from .routers import myrouter as myrouter_module` in `main.py`
3. Add `app.include_router(myrouter_module.router)` in `main.py`
4. Add corresponding API functions to `frontend/src/api/myrouter.ts`

### Adding a new frontend page
1. Create `frontend/src/pages/MyPage.tsx`
2. Import and add `<Route path="mypage" element={<MyPage />} />` in `App.tsx`
3. Add nav entry in `frontend/src/components/layout/Sidebar.tsx`

### Updating tax brackets for a new year
1. Open `backend/app/services/tax_engine.py`
2. Add entries to `FEDERAL_BRACKETS`, `ONTARIO_BRACKETS`, `RRSP_LIMITS`, `TFSA_LIMITS`
3. Update the `TaxYearCheck` seed in `seed.py`
4. Run tests: `cd backend && pytest tests/test_tax_engine.py -v`
5. Commit and push — GitHub Actions builds new image automatically

---

## 8. Testing

Run all tests:
```bash
cd backend
pip install -r requirements.txt pytest
pytest tests/ -v
```

Test coverage targets:
- `test_tax_engine.py` — All CRA brackets, capital gains inclusion, RRSP/TFSA room
- `test_acb_calculator.py` — Buy/sell ACB calculation, superficial loss detection, ROC
- `test_forecast_engine.py` — Compounding math, maternity leave income reduction

Tests use an **in-memory SQLite** database (not the production database).
Tests are deterministic — no randomness, no network calls.

**CI**: Tests run automatically on every push and PR via `.github/workflows/ci.yml`.

---

## 9. Data Safety Rules

**NEVER do these things:**
- Never run `Base.metadata.drop_all()` anywhere in the codebase
- Never create a migration that DROPs a column (add nullable column instead)
- Never delete the `/app/data/` volume when updating
- Never run `alembic downgrade` without user consent

**Safe migration pattern:**
```python
# GOOD: additive only
op.add_column('accounts', sa.Column('new_field', sa.String(), nullable=True))

# BAD: never do this
op.drop_column('accounts', 'existing_field')
```

**Backup before any migration:**
The startup sequence is:
1. Backup database → `/app/data/backups/pre_migration_YYYYMMDD.db`
2. Run `alembic upgrade head`
3. Start uvicorn

---

## 10. Deployment

### Unraid (production)
- Docker image: `ghcr.io/seaniedire/doyle-financial-planner:latest`
- Port: host `8080` → container `80`
- Volume: host `/mnt/user/appdata/doyle-financial-planner/data` → container `/app/data`
- Environment: `ANTHROPIC_API_KEY=sk-ant-...`
- Updates: "Check for Updates" button in Unraid Docker UI → pulls latest GHCR image

### Local Mac (development)
```bash
cp .env.example .env        # add API key
docker-compose up --build   # builds from source, hot-reload via volume mounts
```
Frontend dev server at `http://localhost:5173` with HMR.
Backend at `http://localhost:8000/docs` (Swagger UI).

### Update process (Unraid)
Either:
- Click "Check for Updates" in Unraid Docker UI → Update
- Or SSH into Unraid and run: `bash /mnt/user/appdata/doyle-financial-planner/scripts/update.sh`

---

## 11. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes (for AI) | From console.anthropic.com. AI features return a clear message if missing. |
| `DATABASE_URL` | No | Defaults to `sqlite:////app/data/financial_planner.db` |
| `FX_CAD_USD` | No | Default 1.3650. CAD per 1 USD. Update when rates change. |

**Security**: `.env` is in `.gitignore` and never committed. The GHCR image contains no secrets.

---

## 12. GitHub Actions

### `ci.yml` — triggered on every push and PR
- Installs Python dependencies
- Runs `pytest tests/ -v --tb=short`
- FAILS the PR if any test fails

### `build-push.yml` — triggered on push to `main` only
- Builds the all-in-one Docker image
- Tags it `:latest` and `:{git-sha}`
- Pushes to `ghcr.io/seaniedire/doyle-financial-planner`
- This is what Unraid's "Check for Updates" detects

---

## 13. What-If Simulator

Located at: `frontend/src/pages/WhatIf.tsx` + `backend/app/routers/whatif.py`

**How it works:**
1. User selects a base scenario
2. User specifies account changes: "Add $100,000 to Sean's RRSP"
3. User specifies income changes: "Increase Sean's salary to $280K from 2027"
4. API runs `project_portfolio()` with modified starting values
5. Shows side-by-side comparison: original vs. modified forecast
6. Simulations can be saved and named for future reference

**No side effects**: what-if simulations NEVER modify account balances.
They pass modified values to the forecast engine and return the result.

---

## 14. Trust Accounts

Family trusts in Canada:
- **Family Discretionary Trust**: common for income splitting. Trustee decides distribution.
  Taxed at beneficiary's rate. 21-year deemed disposition (ITA s.104(4)).
- **Testamentary Trust**: created by will. Graduated rates for first 36 months, then top rate.
- **RESP**: not technically a trust but modeled here as a trust-like account.

Trust accounts link to the `trusts` table via `accounts.trust_id`.
Assets NOT held in brokerage accounts are tracked in `trust_assets`.

---

## 15. Known Issues & TODOs

- PSNY (Polestar): USD position. Market value is approximated using `fx_cad_usd` setting.
  True CAD value requires daily FX rate. TODO: add FX rate API integration.
- Provincial tax: currently only Ontario implemented. TODO: add BC, Alberta, Quebec.
- RRSP contribution room: calculation uses 18% rule. Actual room from CRA My Account
  may differ due to pension adjustments. User should enter CRA's number directly.
- The `last trends` growth rates in forecast_engine.py are based on historical ETF
  returns as of 2024 and should be updated periodically.
- Trust 21-year rule: the app tracks trust creation dates but does NOT automatically
  calculate or flag the 21-year deemed disposition. Add a notification TODO.
