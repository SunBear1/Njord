# ⚓ Njord — Kalkulator inwestycyjny

**Akcje (USD) vs polskie obligacje skarbowe / konto oszczędnościowe**

> Wyłącznie do celów edukacyjnych. Nie stanowi doradztwa inwestycyjnego.

🔗 **[Demo → njord.pages.dev](https://njord.pages.dev)**

![Njord screenshot](screenshots/Screenshot%202026-04-06%20at%2019.47.00.png)

---

## Co robi aplikacja?

Njord pozwala porównać potencjalny zysk z portfela akcji notowanych w USD z zyskiem z:
- **konta oszczędnościowego** (oprocentowanie w skali roku, kapitalizacja miesięczna),
- **polskich obligacji skarbowych** (8 typów, stałe/zmiennoprocentowe/inflacyjne).

Wszystkie obliczenia uwzględniają **podatek Belki (19%)** oraz kurs USD/PLN.

---

## Funkcje

| Funkcja | Opis |
|---------|------|
| 📈 Dane giełdowe live | Cena akcji i historia z [Twelve Data API](https://twelvedata.com) (klucz po stronie serwera) |
| 💱 Kurs walutowy live | PLN/USD z [NBP API](https://api.nbp.pl) |
| 📊 Inflacja live | HICP dla Polski z [ECB API](https://data-api.ecb.europa.eu) |
| 🎯 3 scenariusze | Bear / Base / Bull z edytowalnym % zmiany akcji i kursu |
| 📉 Analiza zmienności | HMM + GARCH + Bootstrap — scenariusze liczone po stronie serwera |
| 🏦 8 typów obligacji | OTS, ROR, DOR, TOS, COI, EDO, ROS, ROD |
| ⏱ Horyzont 1m–12r | Suwak horyzontu czasowego (do 5 lat dla oszczędności, do 12 lat dla obligacji) |
| 📊 Wykresy | Porównanie słupkowe, timeline, mapa breakeven (heatmapa Δakcje × ΔFX) |
| 🔒 Klucz API po stronie serwera | Klucz Twelve Data przechowywany jako sekret Cloudflare — nigdy nie trafia do przeglądarki |

### Obsługiwane obligacje skarbowe

| Symbol | Nazwa | Zapadalność | Oprocentowanie |
|--------|-------|-------------|----------------|
| OTS | 3-miesięczne | 3 mies. | stałe |
| ROR | Roczne | 12 mies. | stopa ref. NBP |
| DOR | 2-letnie | 24 mies. | stopa ref. NBP + marża |
| TOS | 3-letnie | 36 mies. | stałe |
| COI | 4-letnie | 48 mies. | inflacja + 1,50% |
| EDO | 10-letnie | 120 mies. | inflacja + 2,00% |
| ROS | 6-letnie (rodzinne) | 72 mies. | inflacja + 2,00% |
| ROD | 12-letnie (rodzinne) | 144 mies. | inflacja + 2,50% |

---

## Architektura

```
Cloudflare Pages
├── / (SPA)        ← React + Vite, serwowany statycznie
└── /api/analyze   ← Pages Function (Workers runtime)
    └── GET ?ticker=AAPL&horizonMonths=12
        - pobiera dane z Twelve Data (klucz sekretny, server-side)
        - pobiera kursy USD/PLN z NBP
        - uruchamia HMM + GARCH + Bootstrap
        - zwraca AssetData + suggestedScenarios
```

---

## Stos technologiczny

- **React 19** + **TypeScript 6**
- **Vite 8** (build + dev server)
- **Tailwind CSS v4**
- **Recharts** (wykresy)
- **Lucide React** (ikony)
- **Cloudflare Pages** + **Pages Functions** (backend + hosting)

---

## Uruchomienie lokalne

```bash
git clone https://github.com/SunBear1/Njord.git
cd Njord
npm install
npm run dev
```

> Bez Pages Functions `/api/analyze` nie jest dostępne lokalnie. Żeby uruchomić pełny stack:
> ```bash
> npm run dev:full   # Vite + Pages Functions na localhost:8788
> ```
> Wymaga pliku `.dev.vars` z kluczem API (patrz niżej).

### Zmienne środowiskowe (lokalnie)

Utwórz plik `.dev.vars` w katalogu głównym (dla Wrangler):

```ini
TWELVE_DATA_API_KEY=twój_klucz
```

> `.dev.vars` jest automatycznie w `.gitignore` Wranglera. Nigdy nie commituj kluczy.

### Komendy

```bash
npm run dev        # serwer deweloperski — tylko frontend (http://localhost:5173/)
npm run dev:full   # pełny stack: Vite + Pages Functions (http://localhost:8788/)
npm run build      # produkcyjny build (tsc + vite)
npm run lint       # ESLint
npm run preview    # podgląd buildu
```

---

## Wdrożenie

### GitOps — Cloudflare Pages

Push na `main` automatycznie buduje i deployuje aplikację przez natywną integrację Cloudflare Pages z GitHub.

**Pierwsze wdrożenie (jednorazowo w dashboardzie CF):**
1. Workers & Pages → Create application → Pages → Connect to Git
2. Wybierz repozytorium i branch `main`
3. Build command: `npm run build`, Output directory: `dist`
4. Environment variables → dodaj `TWELVE_DATA_API_KEY` (Encrypted)

Po tym kroku każdy push na `main` wyzwala automatyczny deploy.

