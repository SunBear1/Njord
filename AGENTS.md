# AGENTS.md — Njord

Instrukcje dla agentów AI pracujących z tym repozytorium.

## Przeglad projektu

**Njord** to aplikacja React/TypeScript SPA (Single Page Application) do porownywania zysku z portfela akcji (notowanych w USD) z zyskiem z polskich instrumentow oszczednosciowych: konta oszczednosciowego lub obligacji skarbowych. Wszystkie obliczenia odbywaja sie w przegladarce — brak backendu.

- **Live demo:** https://sunbear1.github.io/Njord/
- **Jezyk UI:** polski
- **Waluta bazowa:** PLN (przeliczenie z USD przez kurs NBP)

---

## Stos technologiczny

| Narzedzie | Wersja | Rola |
|-----------|--------|------|
| React | 19 | UI framework |
| TypeScript | 6 | jezyk |
| Vite | 8 | bundler + dev server |
| Tailwind CSS | v4 | stylowanie (utility-first) |
| Recharts | 3 | wykresy |
| Lucide React | 1 | ikony |

---

## Komendy

```bash
npm run dev      # dev server -> http://localhost:5173/Njord/
npm run build    # tsc -b && vite build
npm run lint     # ESLint
npm run preview  # podglad buildu produkcyjnego
```

Aby zbudowac z kluczem API:
```bash
VITE_TWELVE_DATA_API_KEY=xxx npm run build
```

---

## Struktura plikow

```
src/
|-- App.tsx                   # glowny komponent, caly stan aplikacji
|-- components/
|   |-- InputPanel.tsx        # lewy panel: ticker, akcje, kurs, benchmark, suwak horyzontu
|   |-- ScenarioEditor.tsx    # edytor 3 scenariuszy (bear/base/bull) + sugestie z historycznej zmiennosci
|   |-- VerdictBanner.tsx     # podsumowanie wynikow (ktore scenariusze bija benchmark)
|   |-- ComparisonChart.tsx   # wykres slupkowy: akcje vs benchmark
|   |-- TimelineChart.tsx     # wykres liniowy: wartosc portfela w czasie
|   |-- BreakevenChart.tsx    # heatmapa: akcje x FX -- gdzie akcje bija benchmark
|   |-- MethodologyPanel.tsx  # opis metodologii obliczen
|   `-- HowItWorks.tsx        # instrukcja uzytkowania
|-- hooks/
|   |-- useAssetData.ts       # fetchowanie danych gieldowych (Twelve Data API)
|   |-- useFxData.ts          # kurs PLN/USD z NBP API (auto-refresh)
|   |-- useCpiGus.ts          # inflacja HICP z ECB API (auto-fetch na starcie)
|   `-- useHistoricalVolatility.ts  # historyczna zmiennosc z danych gieldowych + FX
|-- providers/
|   |-- twelveDataProvider.ts # fetch time_series z Twelve Data, 252 dni historii
|   `-- nbpProvider.ts        # fetch kurs USD/PLN z api.nbp.pl
|-- utils/
|   |-- calculations.ts       # cala logika finansowa (pure functions)
|   |-- assetConfig.ts        # stale (DEFAULT_HORIZON_MONTHS = 12)
|   `-- formatting.ts         # formatowanie liczb (fmtUSD, fmtNum)
`-- types/
    |-- scenario.ts           # typy: ScenarioKey, BenchmarkType, BondPreset, ScenarioResult
    `-- asset.ts              # typy: AssetData, HistoricalPrice
```

---

## Zewnetrzne API

| API | URL | Cel | CORS |
|-----|-----|-----|------|
| Twelve Data | `https://api.twelvedata.com/time_series` | ceny akcji, 252 sesji | tak (wymaga klucza) |
| NBP | `https://api.nbp.pl/api/exchangerates/...` | kurs USD/PLN | tak (bezklucza) |
| ECB HICP | `https://data-api.ecb.europa.eu/service/data/ICP/M.PL.N.000000.4.ANR` | inflacja PL | tak (bezklucza) |

**Twelve Data free tier:** 800 req/dzien, 8/min. Klucz uzytkownika przechowywany w `localStorage` pod kluczem `njord_twelve_data_api_key`. Mozna tez ustawic klucz wbudowany przez `VITE_TWELVE_DATA_API_KEY`.

---

## Logika obliczen (`src/utils/calculations.ts`)

- **Podatek Belki:** 19% od zysku (stala `BELKA_TAX = 0.19`)
- **Konto oszczednosciowe:** kapitalizacja miesieczna: `(1 + r/12)^n`
- **Obligacje:** rok-po-roku, rozny procent za rok 1 vs lata 2+; kara za wczesny wykup potraca sie od brutto przed podatkiem
- **Akcje:** `shares * priceUSD * fxRate`; zysk/strata po podatku Belki; scenariusze skaluja delta liniowo w czasie dla wykresu timeline
- **Heatmapa:** siatka deltaStock x deltaFx (-20% do +20%, krok 4%)

---

## Typy obligacji skarbowych

8 presetow zdefiniowanych w `src/components/InputPanel.tsx` (stala `BOND_PRESETS`):

| id | Nazwa | Zapadalnosc | Typ oprocentowania | Rok 1 | Marza |
|----|-------|-------------|-------------------|-------|-------|
| OTS | 3-mies. | 3 mies. | fixed | 2.00% | 0 |
| ROR | Roczne | 12 mies. | reference (NBP) | 4.00% | 0 |
| DOR | 2-letnie | 24 mies. | reference (NBP) | 4.15% | 0.15% |
| TOS | 3-letnie | 36 mies. | fixed | 4.40% | 0 |
| COI | 4-letnie | 48 mies. | inflation | 4.75% | 1.50% |
| EDO | 10-letnie | 120 mies. | inflation | 5.35% | 2.00% |
| ROS | 6-letnie (rodzinne) | 72 mies. | inflation | 5.00% | 2.00% |
| ROD | 12-letnie (rodzinne) | 144 mies. | inflation | 5.60% | 2.50% |

`BondRateType`: `fixed` | `reference` | `inflation`

Efektywna stopa dla lat 2+:
- `fixed` -> `bondFirstYearRate` (bez zmiany)
- `reference` -> `nbpRefRate + margin`
- `inflation` -> `inflationRate + margin`

---

## Stan aplikacji (App.tsx)

Caly stan jest w `App.tsx` i przekazywany do komponentow przez props. Brak globalnego store (Redux/Zustand). Kluczowe stany:

| Stan | Typ | Opis |
|------|-----|------|
| `horizonMonths` | `number` | 1-144, default 12; max 60 dla trybu savings |
| `benchmarkType` | `BenchmarkType` | `'savings'` lub `'bonds'` |
| `scenarios` | `Scenarios` | bear/base/bull: deltaStock + deltaFx w % |
| `wibor3m` | `number` | oprocentowanie konta w % rocznie |
| `bondFirstYearRate` | `number` | % za rok 1 obligacji |
| `bondPenalty` | `number` | kara za wczesny wykup w % kapitalu |
| `inflationRate` | `number` | inflacja HICP w % rocznie (auto-fetch) |
| `nbpRefRate` | `number` | stopa referencyjna NBP w % |

---

## Wazne konwencje

- **Jezyk UI:** polski (etykiety, komunikaty bledow, opisy)
- **Stylowanie:** wylacznie Tailwind CSS v4 (utility classes); brak CSS modules ani styled-components
- **Komponenty:** funkcyjne z hookami; brak klas; props jawnie typowane przez interfejsy
- **Brak routingu** — aplikacja jednoekranowa
- **Brak testow** — brak konfiguracji testowej (vitest, jest)
- **Base path:** `/Njord/` (vite.config.ts) — wymagane dla GitHub Pages
- **Deploy:** automatyczny na `main` push przez `.github/workflows/deploy.yml`

---

## Typowe zadania

### Dodanie nowego typu obligacji
1. Dodaj obiekt do tablicy `BOND_PRESETS` w `src/components/InputPanel.tsx`
2. Upewnij sie, ze `rateType` jest jednym z `'fixed' | 'reference' | 'inflation'`
3. Sprawdz czy `maturityMonths <= 144` (max suwaka dla bonds)

### Zmiana zakresu suwaka horyzontu
- `src/components/InputPanel.tsx` linia ~584: `max={benchmarkType === 'savings' ? 60 : 144}`
- `src/App.tsx` linia ~92: clampowanie przy przelaczeniu na savings
- Ticki suwaka sa absolutnie pozycjonowane — aktualizuj tez tablice `TICKS_SAVINGS` / `TICKS_MAIN`

### Zmiana logiki obliczen
- Wylacznie `src/utils/calculations.ts` — pure functions, brak side effects
- Sprawdz `calcAllScenarios`, `calcTimeline`, `calcHeatmap`

### Dodanie nowego wykresu
- Utwórz komponent w `src/components/`
- Dane z `calcTimeline`/`calcHeatmap`/`calcAllScenarios` — przekaz przez props z App.tsx
- Uzyj Recharts (patrz istniejace komponenty jako przyklad)
