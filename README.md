# ⚓ Njord

> Polish-language investment calculator — USD stock/ETF portfolio vs Polish savings instruments.

[![Deploy](https://img.shields.io/badge/live-njord.pages.dev-blue)](https://njord.pages.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> **Wyłącznie do celów edukacyjnych. Nie stanowi doradztwa inwestycyjnego.**

---

## Funkcje

Njord dostarcza pięć narzędzi dostępnych z poziomu jednego SPA:

| Widok | Co robi |
|-------|---------|
| **Porównanie** (`/comparison`) | Bear / Base / Bull dla portfela akcji USD vs konto oszczędnościowe, 8 typów obligacji skarbowych i ETF; heatmapa breakeven (Δakcje × ΔFX) |
| **Prognoza** (`/forecast`) | Analiza optymalnej ceny sprzedaży — Monte Carlo + HMM (10 tys. ścieżek) |
| **Podatek Belki** (`/tax`) | Kalkulator 19% podatku od zysków kapitałowych: wiele transakcji, auto-kurs NBP Tabela A, grupowanie PIT-38, import E*Trade XLSX |
| **Kreator portfela** (`/portfolio`) | 4-krokowy kreator długoterminowej alokacji (IKE / IKZE / rachunek maklerski) z symulacją akumulacji |
| **Kursy** (`/rates`) | Bieżące kursy walut i stopy procentowe |

**Dane live:**
- 📈 Ceny akcji — [Yahoo Finance](https://finance.yahoo.com) (primary) + Twelve Data (fallback na 429)
- 💱 Kurs USD/PLN — [NBP API](https://api.nbp.pl) + Alior Kantor
- 📊 Inflacja HICP — [ECB API](https://data-api.ecb.europa.eu)

**Silnik predykcji (po stronie klienta):**
- ≤ 6 miesięcy → Block Bootstrap (historyczna zmienność)
- \> 6 miesięcy → kalibrowany GBM (drift skurczony do 8% prior equity)
- Prognoza ceny → HMM (tylko widok `/forecast`)

### Obsługiwane obligacje skarbowe

| Symbol | Zapadalność | Oprocentowanie |
|--------|-------------|----------------|
| OTS | 3 mies. | stałe |
| ROR | 12 mies. | stopa ref. NBP |
| DOR | 24 mies. | stopa ref. NBP + marża |
| TOS | 36 mies. | stałe |
| COI | 48 mies. | inflacja + 1,50% |
| EDO | 120 mies. | inflacja + 2,00% |
| ROS | 72 mies. (rodzinne) | inflacja + 2,00% |
| ROD | 144 mies. (rodzinne) | inflacja + 2,50% |

---

## Architektura

```
Cloudflare Pages
├── / (SPA — React 19 + Vite)
│   ├── /                ← strona główna
│   ├── /comparison      ← porównanie inwestycji
│   ├── /forecast        ← prognoza ceny sprzedaży
│   ├── /tax             ← kalkulator podatku Belki
│   ├── /portfolio       ← kreator portfela
│   └── /rates           ← kursy walut i stopy
│
└── Pages Functions (backend)
    ├── /api/market-data     ← Yahoo Finance (primary) + Twelve Data (fallback) + NBP FX; cache 1h
    ├── /api/bonds           ← presety obligacji z CSV; cache 24h
    ├── /api/currency-rates  ← Alior Kantor + NBP Tabela C
    ├── /api/inflation       ← inflacja HICP z ECB; cache 24h
    └── /api/auth/*          ← JWT + OAuth (GitHub, Google); Cloudflare D1
```

Wszystkie obliczenia finansowe (GBM, Bootstrap, Monte Carlo, podatek Belki) wykonywane są **po stronie klienta**.

---

## Stos technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Frontend | React 19, TypeScript 6, Vite 8 |
| Stylowanie | Tailwind CSS v4 (semantic tokens w `src/index.css`) |
| Wykresy | Recharts 3 |
| Ikony | Lucide React |
| Backend | Cloudflare Pages Functions (edge) |
| Baza danych | Cloudflare D1 (SQLite — tylko auth) |
| Testy jednostkowe | Vitest (500+ testów) |
| Testy E2E | Playwright |

---

## Uruchomienie lokalne

```bash
git clone https://github.com/SunBear1/Njord.git
cd Njord
npm install
npm run dev          # tylko frontend → http://localhost:5173/
```

Pełny stack z Pages Functions (wymagany dla danych giełdowych):

```bash
npm run dev:full     # Vite + Pages Functions → http://localhost:8788/
```

### Zmienne środowiskowe

Utwórz `.dev.vars` w katalogu głównym (dla Wrangler — nigdy nie commituj):

```ini
TWELVE_DATA_API_KEY=twój_klucz          # opcjonalny fallback dla Yahoo Finance
JWT_SECRET=losowy_ciąg_znaków           # wymagany dla auth
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Wszystkie komendy

```bash
npm run dev          # serwer deweloperski — tylko frontend (localhost:5173)
npm run dev:full     # pełny stack: Vite + Pages Functions (localhost:8788)
npm run build        # produkcyjny build: tsc -b && vite build → dist/
npm run lint         # ESLint (zero błędów wymagane)
npm test             # Vitest — testy jednostkowe
npm run test:e2e     # Playwright — testy E2E (wymaga serwera preview)
npm run preview      # podgląd lokalny buildu produkcyjnego
```

---

## Wdrożenie

Push na `main` automatycznie buduje i deployuje przez integrację Cloudflare Pages ↔ GitHub.

**Pierwsze wdrożenie (jednorazowo w dashboardzie CF):**
1. Workers & Pages → Create application → Pages → Connect to Git
2. Wybierz repozytorium, branch `main`
3. Build command: `npm run build` | Output directory: `dist`
4. Environment variables → dodaj wszystkie sekrety (Encrypted)

---

## Licencja

[MIT](LICENSE)

