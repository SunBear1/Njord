Financial API — Implementation Plan for Copilot CLI

Overview

Stateless financial data API on Cloudflare Pages Functions. Workers proxy upstream APIs, D1 stores only scraped data. Caching is client-side only (React Query staleTime).

| Aspect | Decision |
|--------|----------|
| Hosting | Cloudflare Pages Functions |
| Infra-as-code | Terraform (Cloudflare provider) |
| Finance DB | Separate Cloudflare D1 — 3 tables, scraped data only |
| User DB | Existing D1 — untouched |
| Server-side cache | None — no KV namespace |
| Client-side cache | React Query: 10s currency, 15min stocks, 1h bonds, 24h inflation |
| CI/CD | GitHub Actions |
| Scraper logs | $GITHUBSTEPSUMMARY — no DB table |

External Sources (validated)

| Domain | Source | Type |
|--------|--------|------|
| Stocks | query2.finance.yahoo.com/v8/finance/chart/{ticker} | JSON API, no auth |
| Bonds | obligacjeskarbowe.pl/oferta-obligacji/ | HTML scrape |
| Currency: NBP | api.nbp.pl/api/exchangerates/rates/C/{code}/ | JSON API |
| Currency: Alior | klient.internetowykantor.pl/api/public/marketBrief | JSON API |
| Currency: Walutomat | user.walutomat.pl/api/public/marketBrief | JSON API |
| Currency: Kantor.pl | banker.kantor.pl/ajax | JSON API |
| Inflation: GUS | api.stat.gov.pl/ | JSON API |
| Inflation: NBP forecast | NBP quarterly PDF | Scrape/parse |

Terraform Infrastructure
Important Terraform cloudflared1database creates the D1 instance but cannot create tables. Table schemas are applied via wrangler d1 execute as a post-provisioning step (Terraform local-exec provisioner or GitHub Actions step).

infra/main.tf

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "cloudflare" {
  apitoken = var.cloudflareapi_token
}

variable "cloudflareapitoken" {
  type      = string
  sensitive = true
}

variable "cloudflareaccountid" {
  type = string
}

============================================
Finance Data D1 (new, scraped data only)
============================================
resource "cloudflared1database" "finance_data" {
  accountid          = var.cloudflareaccount_id
  name                = "finance-data-db"
  primarylocationhint = "weur"
}

============================================
Apply schema after D1 creation
============================================
resource "nullresource" "financedb_schema" {
  dependson = [cloudflared1database.financedata]

  provisioner "local-exec" {
    command = <<-EOT
      npx wrangler d1 execute ${cloudflared1database.finance_data.name} \
        --remote \
        --file=./sql/schema.sql
    EOT
  }

  triggers = {
    schema_hash = filesha256("./sql/schema.sql")
  }
}

============================================
Outputs for wrangler.toml / GH Actions
============================================
output "financedbid" {
  value = cloudflared1database.finance_data.id
}

output "financedbname" {
  value = cloudflared1database.finance_data.name
}


infra/variables.tfvars (example, gitignored)

cloudflareapitoken  = "<from-env>"
cloudflareaccountid = "<your-account-id>"


sql/schema.sql

CREATE TABLE IF NOT EXISTS bonds (
  id                TEXT PRIMARY KEY,
  name_pl           TEXT NOT NULL,
  maturity_months   INTEGER NOT NULL,
  rate_type         TEXT NOT NULL,
  firstyearrate_pct   REAL,
  margin_pct        REAL,
  coupon_frequency  INTEGER NOT NULL,
  earlyredemptionallowed  INTEGER NOT NULL DEFAULT 1,
  earlyredemptionpenalty_pct  REAL,
  is_family         INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inflation_historical (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  year              INTEGER NOT NULL,
  month             INTEGER NOT NULL,
  cpiyoypct       REAL NOT NULL,
  cpimompct       REAL,
  corecpiyoy_pct  REAL,
  source            TEXT NOT NULL DEFAULT 'gus',
  fetched_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(year, month, source)
);

CREATE INDEX IF NOT EXISTS idxinflationdate
  ON inflation_historical(year, month);

CREATE TABLE IF NOT EXISTS inflation_forecasts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date       TEXT NOT NULL,
  forecast_year     INTEGER NOT NULL,
  forecast_quarter  INTEGER NOT NULL,
  centralpathpct  REAL NOT NULL,
  lower50pct      REAL,
  upper50pct      REAL,
  lower90pct      REAL,
  upper90pct      REAL,
  fetched_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(reportdate, forecastyear, forecast_quarter)
);

CREATE INDEX IF NOT EXISTS idxforecastreport
  ON inflationforecasts(reportdate);


Directory Structure

.
├── infra/
│   ├── main.tf
│   └── variables.tfvars
├── sql/
│   ├── schema.sql
│   └── seed-bonds.sql
├── functions/
│   ├── auth/                        # existing, untouched
│   └── finance/
│       ├── _shared/
│       │   ├── db.ts
│       │   ├── errors.ts
│       │   └── types.ts
│       ├── stocks/
│       │   ├── [ticker].ts          # GET /finance/stocks/:ticker
│       │   └── search.ts            # GET /finance/stocks/search?q=
│       ├── bonds/
│       │   └── index.ts             # GET /finance/bonds
│       ├── currency/
│       │   ├── index.ts             # GET /finance/currency
│       │   └── _adapters/
│       │       ├── nbp.ts
│       │       ├── alior.ts
│       │       ├── walutomat.ts
│       │       └── kantor-pl.ts
│       └── inflation/
│           ├── index.ts             # GET /finance/inflation
│           └── forecast.ts          # GET /finance/inflation/forecast
├── scripts/
│   └── scrapers/
│       ├── scrape-bonds.ts
│       ├── fetch-gus-cpi.ts
│       └── fetch-nbp-forecast.ts
├── .github/
│   └── workflows/
│       ├── deploy.yml
│       ├── scrape-bonds.yml
│       ├── fetch-gus-cpi.yml
│       └── fetch-nbp-forecast.yml
└── wrangler.toml


New Data Publication Handling
Bonds Daily scrape at 06:00 UTC. Diff against D1 → upsert changed rows. Catches mid-month rate promotions. Result → $GITHUBSTEPSUMMARY.
GUS CPI Triple-tap cron (10th, 15th, 20th monthly). Idempotent insert — skips if month already exists.
NBP Forecast Daily check 5th-20th of Mar/Jul/Nov. If new report detected → parse and insert. Skip otherwise.

All scrapers write diffs/results to $GITHUBSTEPSUMMARY. GH Actions auto-notifies on failure.

Copilot CLI Execution Plan

Run copilot in terminal, switch to Plan Mode (Shift+Tab), paste each task block. Approve → execute.

Task 1: Scaffold infrastructure

Create the infra/ directory with a Terraform config for Cloudflare.
Create file infra/main.tf that:
Uses cloudflare/cloudflare provider ~> 5.0
Defines variables: cloudflareapitoken (sensitive), cloudflareaccountid
Creates a cloudflared1database resource named "finance-data-db" with primarylocationhint "weur"
Uses null_resource with local-exec provisioner to run: npx wrangler d1 execute <db-name> --remote --file=./sql/schema.sql
Triggers re-run when sql/schema.sql changes (filesha256)
Outputs financedbid and financedbname

Create file sql/schema.sql with 3 tables:
bonds (id TEXT PK, namepl TEXT, maturitymonths INT, ratetype TEXT, firstyearratepct REAL, marginpct REAL, couponfrequency INT, earlyredemptionallowed INT DEFAULT 1, earlyredemptionpenaltypct REAL, isfamily INT DEFAULT 0, updated_at TEXT DEFAULT datetime('now'))
inflationhistorical (id INT PK AUTOINCREMENT, year INT, month INT, cpiyoypct REAL, cpimompct REAL, corecpiyoypct REAL, source TEXT DEFAULT 'gus', fetched_at TEXT DEFAULT datetime('now'), UNIQUE(year, month, source)) with index on (year, month)
inflationforecasts (id INT PK AUTOINCREMENT, reportdate TEXT, forecastyear INT, forecastquarter INT, centralpathpct REAL, lower50pct REAL, upper50pct REAL, lower90pct REAL, upper90pct REAL, fetchedat TEXT DEFAULT datetime('now'), UNIQUE(reportdate, forecastyear, forecastquarter)) with index on report_date

All tables use CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.


Task 2: Shared utilities

Create functions/finance/_shared/ with these TypeScript files:

types.ts — Export interfaces:
   - Bond { id, namepl, maturitymonths, ratetype, firstyearratepct, marginpct, couponfrequency, earlyredemptionallowed, earlyredemptionpenaltypct, isfamily, updated_at }
   - CurrencyRate { source, pair, bid, ask, mid?, timestamp }
   - InflationDataPoint { year, month, cpiyoypct, cpimompct?, corecpiyoy_pct? }
   - InflationForecast { reportdate, forecastyear, forecastquarter, centralpathpct, lower50pct?, upper50pct?, lower90pct?, upper90_pct? }
   - StockBar { timestamp, open, high, low, close, volume }
   - ApiMeta { source, lastupdatedat?, nextexpectedupdate? }
   - ApiResponse<T> { data: T, _meta: ApiMeta }

errors.ts — Export:
   - ApiError class extending Error with statusCode, upstream, code properties
   - errorResponse(error: ApiError) returning Response with JSON { error: string, code: string, upstream?: string }
   - Predefined errors: BADREQUEST, UPSTREAMERROR, NOT_FOUND

db.ts — Export helper:
   - getFinanceDb(env: Env) returning the FINANCE_DB D1 binding
   - queryBonds(db, filters?) returning Bond[]
   - queryInflation(db, from?, to?) returning InflationDataPoint[]
   - queryForecasts(db, report?) returning InflationForecast[]

Use Cloudflare Workers types. Env should extend { FINANCE_DB: D1Database }.


Task 3: Currency adapters + endpoint

Create functions/finance/currency/_adapters/ with 4 adapter files. Each exports an async function that takes no auth and returns CurrencyRate[] for USD/PLN, EUR/PLN, GBP/PLN.

nbp.ts — Fetch https://api.nbp.pl/api/exchangerates/rates/C/{code}/ for USD, EUR, GBP. Parse JSON response to extract bid/ask from rates[0]. Source name: "nbp".

alior.ts — Fetch https://klient.internetowykantor.pl/api/public/marketBrief. Parse JSON, filter to USD/PLN, EUR/PLN, GBP/PLN pairs. Source name: "alior".

walutomat.ts — Fetch https://user.walutomat.pl/api/public/marketBrief. Same structure as alior (same company Currency One). Source name: "walutomat".

kantor-pl.ts — Fetch https://banker.kantor.pl/ajax. Parse JSON for USD, EUR, GBP rates. Source name: "kantor_pl".

Each adapter: handles fetch errors gracefully, returns empty array on failure (partial degradation). Sets User-Agent header.

Create functions/finance/currency/index.ts:
GET /finance/currency
Query params: pairs (default "USD/PLN,EUR/PLN,GBP/PLN"), source (default "all", options: nbp, alior, walutomat, kantor_pl, all)
If source=all, fetch all 4 adapters in parallel with Promise.allSettled
Return { data: CurrencyRate[], _meta: { source: "aggregated" } }
Validate pairs against allowed set


Task 4: Stocks endpoint

Create functions/finance/stocks/[ticker].ts:
GET /finance/stocks/:ticker
Query params: interval (default "1d", allowed: 5m, 15m, 30m, 1h, 1d, 1wk, 1mo), range (default "1mo", allowed: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y)
Validation: reject 5m with range > 60d (1mo max), reject 1h with range > 2y
Proxy to https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?interval={interval}&range={range}
Set User-Agent header: "Mozilla/5.0"
Parse Yahoo response: extract timestamps + indicators.quote[0].{open,high,low,close,volume}
Return { data: StockBar[], _meta: { source: "yahoo" } }
Handle Yahoo errors (404 = invalid ticker, 429 = rate limited)

Create functions/finance/stocks/search.ts:
GET /finance/stocks/search?q=
Proxy to https://query2.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=10&newsCount=0
Return simplified results: { symbol, shortname, exchange, quoteType }


Task 5: Bonds endpoint

Create functions/finance/bonds/index.ts:
GET /finance/bonds
Query params: type (optional, filter by bond id like OTS, TOS, COI, EDO, ROS, ROD), is_family (optional boolean)
Read from FINANCE_DB D1 binding, query bonds table
Build WHERE clause dynamically based on filters
Return { data: Bond[], meta: { source: "obligacjeskarbowe.pl", lastupdatedat: <max updatedat from results> } }


Task 6: Inflation endpoints

Create functions/finance/inflation/index.ts:
GET /finance/inflation
Query params: from (YYYY-MM, default 12 months ago), to (YYYY-MM, default current month)
Read from FINANCEDB inflationhistorical table
WHERE year100+month >= from AND year100+month <= to
Return { data: InflationDataPoint[], _meta: { source: "gus" } }

Create functions/finance/inflation/forecast.ts:
GET /finance/inflation/forecast
Query param: report (YYYY-MM, default latest report_date)
Read from FINANCEDB inflationforecasts table
If no report param: SELECT DISTINCT reportdate ORDER BY reportdate DESC LIMIT 1
Return { data: InflationForecast[], _meta: { source: "nbp" } }


Task 7: Bond scraper + GH Action

Create scripts/scrapers/scrape-bonds.ts:
Fetch https://www.obligacjeskarbowe.pl/oferta-obligacji/
Parse HTML to extract all bond types and their parameters (id, namepl, maturitymonths, ratetype, firstyearratepct, marginpct, couponfrequency, earlyredemptionallowed, earlyredemptionpenaltypct, isfamily)
Connect to D1 via Cloudflare REST API using env vars CFAPITOKEN, CFACCOUNTID, CFD1DATABASE_ID
For each parsed bond: INSERT OR REPLACE into bonds table
Write summary to process.env.GITHUBSTEPSUMMARY: table showing bond id, rate, whether it was inserted/updated/unchanged
On failure: write error to GITHUBSTEPSUMMARY and exit with code 1

Create .github/workflows/scrape-bonds.yml:
Schedule: cron '0 6   *' + workflow_dispatch
Steps: checkout, setup-node 20, npm ci, run npx tsx scripts/scrapers/scrape-bonds.ts
Env: CFAPITOKEN, CFACCOUNTID, CFD1DATABASE_ID from secrets


Task 8: Inflation scrapers + GH Actions

Create scripts/scrapers/fetch-gus-cpi.ts:
Fetch CPI data from GUS API (api.stat.gov.pl)
Parse latest available month's CPI YoY, MoM, and core CPI
Connect to D1 via Cloudflare REST API
INSERT OR IGNORE into inflation_historical (skip if month already exists)
Write result to GITHUBSTEPSUMMARY

Create scripts/scrapers/fetch-nbp-forecast.ts:
Check NBP website for latest Inflation Report
Parse forecast data: central path + 50%/90% confidence bands per quarter
INSERT OR IGNORE into inflation_forecasts
Write result to GITHUBSTEPSUMMARY

Create .github/workflows/fetch-gus-cpi.yml:
Schedule: cron '0 10 10,15,20  ' + workflow_dispatch
Same pattern as bonds workflow

Create .github/workflows/fetch-nbp-forecast.yml:
Schedule: cron '0 10 5-20 3,7,11 *' + workflow_dispatch
Same pattern as bonds workflow


Task 9: Wrangler config + deploy workflow

Update wrangler.toml to add the FINANCE_DB binding:

[[d1_databases]]
binding = "FINANCE_DB"
database_name = "finance-data-db"
database_id = "<populated-from-terraform-output>"

Do NOT add any KV namespaces.
Do NOT touch any existing d1_databases bindings (user DB stays as-is).

Create .github/workflows/deploy.yml:
Trigger: push to main
Steps: checkout, setup-node 20, npm ci, typecheck, test, deploy with wrangler pages deploy
Env: CLOUDFLAREAPITOKEN from secrets


Task 10: React Query hooks

Create src/hooks/useFinanceApi.ts (or similar, adapt to existing app structure):

useStockData(ticker, interval, range) — staleTime: 15  60  1000 (15min)
useCurrencyRates(pairs?, source?) — staleTime: 10  1000 (10s), refetchInterval: 10  1000
useBonds(type?, is_family?) — staleTime: 60  60  1000 (1h)
useInflation(from?, to?) — staleTime: 24  60  60 * 1000 (24h)
useInflationForecast(report?) — staleTime: 24  60  60 * 1000 (24h)

Each hook uses useQuery from @tanstack/react-query.
Base URL should come from environment config.
All hooks return { data, isLoading, error, _meta }.


Execution Order

terraform init + apply          → D1 created + schema applied
Task 2: _shared/ types          → foundation
Task 3: currency                → simplest, all JSON APIs
Task 4: stocks                  → pure proxy
Task 5: bonds endpoint          → reads D1
Task 6: inflation endpoints     → reads D1
Task 7: bond scraper            → populates D1
Task 8: inflation scrapers      → populates D1  
Task 9: wrangler + deploy       → ship it
Task 10: React hooks           → client integration


Risks

| Risk | Mitigation |
|------|------------|
| Yahoo blocks CF Workers IPs | Fallback to query1 domain |
| obligacjeskarbowe.pl HTML changes | GH Actions failure alerts; dane.gov.pl fallback |
| GUS publication date varies | Triple-tap cron (10th/15th/20th); idempotent |
| NBP forecast date varies | Daily check during window; idempotent |
| Currency API breaks | 4 independent sources; Promise.allSettled = graceful degradation |
