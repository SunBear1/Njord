# ⚓ Njord

> Polish-language investment calculator — USD stock/ETF portfolio vs Polish savings instruments.

[![Deploy](https://img.shields.io/badge/live-njord.pages.dev-blue)](https://njord.pages.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> **For educational purposes only. Not investment advice.**

---

## Features

Njord provides five tools in a single SPA:

| View | Description |
|------|-------------|
| **Comparison** (`/comparison`) | Bear / Base / Bull scenarios for a USD stock portfolio vs savings account, 8 Polish bond types, and ETFs; breakeven heatmap (Δstocks × ΔFX) |
| **Forecast** (`/forecast`) | Optimal sell-price analysis — Monte Carlo + HMM (10,000 paths) |
| **Belka Tax** (`/tax`) | 19% capital gains tax calculator: multiple transactions, auto NBP Table A rate lookup, PIT-38 grouping, E*Trade XLSX import |
| **Portfolio Builder** (`/portfolio`) | 4-step long-term allocation wizard (IKE / IKZE / brokerage account) with accumulation simulation |
| **Rates** (`/rates`) | Live exchange rates and interest rates |

**Live data sources:**
- 📈 Stock prices — [Yahoo Finance](https://finance.yahoo.com) (primary) + Twelve Data (fallback on 429)
- 💱 USD/PLN rate — [NBP API](https://api.nbp.pl) + Alior Kantor
- 📊 HICP inflation — [ECB API](https://data-api.ecb.europa.eu)

**Prediction engine (client-side):**
- ≤ 6 months → Block Bootstrap (historical volatility)
- \> 6 months → Calibrated GBM (drift shrunk to 8% equity prior)
- Price forecast → HMM (only on `/forecast`)

### Supported Polish government bonds

| Symbol | Maturity | Interest |
|--------|----------|----------|
| OTS | 3 mo. | fixed |
| ROR | 12 mo. | NBP reference rate |
| DOR | 24 mo. | NBP reference rate + margin |
| TOS | 36 mo. | fixed |
| COI | 48 mo. | inflation + 1.50% |
| EDO | 120 mo. | inflation + 2.00% |
| ROS | 72 mo. (family) | inflation + 2.00% |
| ROD | 144 mo. (family) | inflation + 2.50% |

---

## Architecture

```
Cloudflare Pages
├── / (SPA — React 19 + Vite)
│   ├── /                ← home
│   ├── /comparison      ← investment comparison
│   ├── /forecast        ← sell-price forecast
│   ├── /tax             ← Belka tax calculator
│   ├── /portfolio       ← portfolio builder
│   └── /rates           ← exchange rates & interest rates
│
└── Pages Functions (backend)
    ├── /api/market-data     ← Yahoo Finance (primary) + Twelve Data (fallback) + NBP FX; 1h cache
    ├── /api/bonds           ← bond presets from CSV; 24h cache
    ├── /api/currency-rates  ← Alior Kantor + NBP Table C
    ├── /api/inflation       ← HICP inflation from ECB; 24h cache
    └── /api/auth/*          ← JWT + OAuth (GitHub, Google); Cloudflare D1
```

All financial calculations (GBM, Bootstrap, Monte Carlo, Belka tax) run **client-side**.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript 6, Vite 8 |
| Styling | Tailwind CSS v4 (semantic tokens in `src/index.css`) |
| Charts | Recharts 3 |
| Icons | Lucide React |
| Backend | Cloudflare Pages Functions (edge) |
| Database | Cloudflare D1 (SQLite — auth only) |
| Unit tests | Vitest (500+ tests) |
| E2E tests | Playwright |

---

## Local development

```bash
git clone https://github.com/SunBear1/Njord.git
cd Njord
npm install
npm run dev          # frontend only → http://localhost:5173/
```

Full stack with Pages Functions (required for market data):

```bash
npm run dev:full     # Vite + Pages Functions → http://localhost:8788/
```

### Environment variables

Create `.dev.vars` in the project root (for Wrangler — never commit this file):

```ini
TWELVE_DATA_API_KEY=your_key            # optional fallback for Yahoo Finance
JWT_SECRET=random_string                # required for auth
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Commands

```bash
npm run dev          # dev server — frontend only (localhost:5173)
npm run dev:full     # full stack: Vite + Pages Functions (localhost:8788)
npm run build        # production build: tsc -b && vite build → dist/
npm run lint         # ESLint (zero errors enforced)
npm test             # Vitest — unit tests
npm run test:e2e     # Playwright — E2E tests (requires preview server)
npm run preview      # local preview of production build
```

---

## Deployment

Push to `main` automatically builds and deploys via the Cloudflare Pages ↔ GitHub integration.

**First-time setup (once in the CF dashboard):**
1. Workers & Pages → Create application → Pages → Connect to Git
2. Select the repository and branch `main`
3. Build command: `npm run build` | Output directory: `dist`
4. Environment variables → add all secrets (Encrypted)

---

## License

[MIT](LICENSE)

