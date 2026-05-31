# Doyle Financial Planner

Private Canadian financial planning application. Tracks investment accounts, ACB, tax
planning (FHSA/RRSP/TFSA), what-if scenarios, family trusts, maternity leave, and house
purchase planning. Runs as a single Docker container on Unraid.

**Features:**
- Live portfolio dashboard with all account balances
- Adjusted Cost Base (ACB) tracker with full CRA-compliant history
- Canadian tax calculator (Federal + Ontario, 2026 CRA rules)
- Portfolio forecasting — conservative / moderate / optimistic scenarios
- **What-If Simulator** — override any account or income value and see 40-year impact
- FHSA + RRSP Home Buyers' Plan strategy for house purchase planning
- Maternity leave financial impact modeling
- Capital loss harvesting analysis
- **Family Trusts** — track assets held inside family trust structures
- **Family Members** — manage adults and children; supports expanding family over time
- Annual CRA rule verification prompt — catches when TFSA limits or brackets change
- AI Advisor powered by Claude

---

## Install on Unraid (one-click — recommended)

The app is published as a Docker image to GitHub Container Registry and ships
with an Unraid Community Apps template.

### Option A — Community Apps XML template

1. In Unraid, go to **Apps → Templates**
2. Add the following URL to your template repositories (Settings → Docker → Template repositories):
   ```
   https://raw.githubusercontent.com/SeaniedIRE/doyle-financial-planner/main/unraid/doyle-financial-planner.xml
   ```
3. Search for "doyle-financial-planner" in Apps and click Install
4. Fill in your Anthropic API key (optional — AI Advisor only)
5. Click Apply

### Option B — Manual Docker run

```bash
docker run -d \
  --name doyle-financial-planner \
  --restart unless-stopped \
  -p 8080:8080 \
  -v /mnt/user/appdata/doyle-financial-planner/data:/app/data \
  -e ANTHROPIC_API_KEY=your-key-here \
  ghcr.io/seaniedire/doyle-financial-planner:latest
```

### Updating

Click **Check for Updates** in the Unraid Docker tab to pull the latest image.
The container will restart automatically. Your data is never touched by updates.

---

## Local development (Mac)

```bash
git clone https://github.com/SeaniedIRE/doyle-financial-planner.git
cd doyle-financial-planner
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env (optional)
docker compose up --build
# App runs at http://localhost:8080
```

Or run the backend and frontend separately without Docker:

```bash
# Terminal 1 — backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
# Vite proxies /api/* to http://localhost:8000
```

---

## Running the test suite

```bash
cd backend
pip install -r requirements.txt pytest pytest-cov
pytest tests/ -v --tb=short --cov=app --cov-report=term-missing
```

Tests cover:
- CRA tax formulas (federal + Ontario brackets, TFSA/RRSP/FHSA limits)
- ACB calculator (buy/sell, fees, reinvested distributions, return of capital, splits, superficial loss)
- Forecast engine (compounding math, maternity leave, FHSA withdrawal at house purchase)

---

## Updating your holdings

Holdings change daily. To update them:

**Option A — Manual edit:** Go to **Holdings & Accounts**, click the edit icon next to any holding.

**Option B — CSV Import:** Go to **Settings → Import Holdings**, paste your broker CSV.

---

## Backing up your data

Your financial data is stored in:
```
/mnt/user/appdata/doyle-financial-planner/data/financial_planner.db
```

**Quick backup:**
```bash
./scripts/backup.sh /mnt/user/backups/financial-planner
```

The entrypoint script also creates an automatic pre-start backup each time the container
restarts (stored in `/app/data/backups/`, last 14 kept).

Set up the **CA Backup** plugin on Unraid to back up
`/mnt/user/appdata/doyle-financial-planner/data/` to your offsite location.

---

## Security

- Protected by Cloudflare Access (Zero Trust) — no app-level login needed
- Your API key is in `.env` on the server only — never committed to git
- `.gitignore` ensures `.env` and the database are never pushed to GitHub
- Security headers (CSP, X-Frame-Options, HSTS) set in nginx

---

## CRA tax rules used

| Rule | ITA section | Value (2026) |
|------|-------------|--------------|
| Capital gains inclusion | s.38(a) | 50% |
| TFSA annual limit | s.146.2 | $7,000 |
| RRSP annual limit | s.146 | $32,490 |
| FHSA annual limit | s.146.6 | $8,000 |
| FHSA lifetime limit | s.146.6 | $40,000 |
| Superficial loss window | s.54 | 30 days before/after |
| Margin interest deduction | s.20(1)(c) | Fully deductible |
| EI maternity benefit | Service Canada | 55% of insurable earnings |
| Federal basic personal amount | s.118(1)(c) | $15,705 |

*Always verify with CRA My Account and a qualified tax professional for your situation.*

---

## Architecture

```
Browser → Cloudflare Tunnel → Unraid :8080 → nginx (single container)
                                                  ↓ /api/* proxy
                                               uvicorn FastAPI
                                                  ↓
                                               SQLite (WAL mode)
                                               /app/data/financial_planner.db
```

Single all-in-one container: nginx + uvicorn managed by supervisord.
This lets Unraid's "Check for Updates" work with a single container entry.
