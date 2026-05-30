# Doyle Financial Planner

Personal financial planning application for Sean & Saudya Doyle.

**Features:**
- Live portfolio dashboard with all account balances
- Adjusted Cost Base (ACB) tracker with full CRA-compliant history
- Canadian tax calculator (Federal + Ontario, CRA 2026 rules)
- Portfolio forecasting with conservative / moderate / optimistic growth scenarios
- FHSA + RRSP Home Buyers' Plan strategy for house purchase (2030/2031)
- Maternity leave financial impact modeling
- Capital loss harvesting analysis (PSNY and others)
- Scenario builder — compare "what if" paths side by side
- AI Advisor powered by Claude — ask anything, get CRA-compliant answers

---

## Deployment on Unraid (Step-by-Step)

### Step 1 — Prerequisites

Make sure these are installed on your Unraid server:
- **Docker** (comes with Unraid)
- **git** — install via Unraid terminal: `apt-get install git` or through the NerdTools plugin

### Step 2 — Clone the repository

In the Unraid terminal (or SSH into your server):

```bash
cd /mnt/user/appdata
git clone https://github.com/SeaniedIRE/doyle-financial-planner.git
cd doyle-financial-planner
```

### Step 3 — Create your .env file

```bash
cp .env.example .env
nano .env
```

Fill in your **Anthropic API key** (get it from console.anthropic.com — needed for AI Advisor).
Save with `Ctrl+X`, then `Y`, then `Enter`.

### Step 4 — Create the data directory

```bash
mkdir -p data
```

This is where your database lives. **Back up this folder regularly.**

### Step 5 — Build and start

```bash
docker-compose up -d --build
```

This will:
1. Build the Python backend and React frontend Docker images (~3–5 minutes first time)
2. Start all three containers (backend, frontend, nginx)
3. Seed the database with your holdings from the CSV files

### Step 6 — Verify it's running

Open a browser on your local network and go to:
```
http://YOUR-UNRAID-IP:8080
```

You should see the dashboard with all your accounts loaded.

### Step 7 — Set up Cloudflare tunnel

In your Cloudflare Zero Trust dashboard:
1. Go to **Access → Tunnels**
2. Edit your existing tunnel (or create one)
3. Add a Public Hostname:
   - **Subdomain:** finance (or whatever you prefer)
   - **Domain:** your-domain.com
   - **Service:** http://localhost:8080
4. Save

Your app is now accessible at `https://finance.your-domain.com` — protected by Cloudflare Access.

### Updating the app

```bash
cd /mnt/user/appdata/doyle-financial-planner
git pull
docker-compose up -d --build
```

---

## Updating Holdings Values

Holdings values change daily. To update them:

**Option A — CSV Import (recommended, takes 30 seconds)**
1. Download your holdings CSV from your broker
2. Go to **Settings → Import Holdings** in the app
3. Paste the CSV contents and click Import

**Option B — Manual edit**
1. Go to **Holdings & Accounts**
2. Click the edit icon (pencil) next to any holding
3. Update the price, quantity, or market value
4. Click Save

---

## Backing Up Your Data

Your financial data is stored in:
```
/mnt/user/appdata/doyle-financial-planner/data/financial_planner.db
```

**To back up:**
```bash
cp /mnt/user/appdata/doyle-financial-planner/data/financial_planner.db \
   /mnt/user/backups/financial_planner_$(date +%Y%m%d).db
```

Set up Unraid's automated backup (CA Backup plugin) to include the `/mnt/user/appdata/doyle-financial-planner/data/` folder.

---

## Security Notes

- The application is protected by Cloudflare Access (Zero Trust) — only you can access it
- No passwords are stored in the app itself (auth is handled by Cloudflare)
- Your API key is stored only in the `.env` file on your server (never committed to GitHub)
- The `.gitignore` ensures `.env` and the database are never pushed to GitHub
- Security headers (CSP, X-Frame-Options, etc.) are set in nginx

---

## CRA Tax Rules Used

| Rule | Source | Value |
|------|--------|-------|
| Capital gains inclusion | ITA s.38 | 50% |
| TFSA annual limit 2026 | CRA | $7,000 |
| RRSP annual limit 2026 | CRA | $32,490 |
| FHSA annual limit | ITA s.146.6 | $8,000 |
| FHSA lifetime limit | ITA s.146.6 | $40,000 |
| HBP withdrawal limit | CRA | $35,000/person |
| Superficial loss window | ITA s.54 | 30 days before/after |
| Margin interest deduction | ITA s.20(1)(c) | Full deduction |
| EI maternity benefit rate | Service Canada | 55% of insurable earnings |

*Always verify with CRA My Account and a qualified tax professional for your specific situation.*

---

## Architecture

```
Browser → Cloudflare Tunnel → Unraid :8080 → nginx → frontend (React)
                                                    ↘ backend API (FastAPI + SQLite)
```

Three Docker containers: `financial-planner-nginx`, `financial-planner-frontend`, `financial-planner-backend`
