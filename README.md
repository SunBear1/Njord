# ⚓ Njord — Kalkulator inwestycyjny

**Akcje (USD) vs polskie obligacje skarbowe / konto oszczędnościowe**

> Wyłącznie do celów edukacyjnych. Nie stanowi doradztwa inwestycyjnego.

🔗 **[Demo → sunbear1.github.io/Njord](https://sunbear1.github.io/Njord/)**

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
| 📈 Dane giełdowe live | Cena akcji i historia z [Twelve Data API](https://twelvedata.com) |
| 💱 Kurs walutowy live | PLN/USD z [NBP API](https://api.nbp.pl) |
| 📊 Inflacja live | HICP dla Polski z [ECB API](https://data-api.ecb.europa.eu) |
| 🎯 3 scenariusze | Bear / Base / Bull z edytowalnym % zmiany akcji i kursu |
| 📉 Analiza zmienności | Sugerowane scenariusze na podstawie historycznej zmienności |
| 🏦 8 typów obligacji | OTS, ROR, DOR, TOS, COI, EDO, ROS, ROD |
| ⏱ Horyzont 1m–12r | Suwak horyzontu czasowego (do 5 lat dla oszczędności, do 12 lat dla obligacji) |
| 📊 Wykresy | Porównanie słupkowe, timeline, mapa breakeven (heatmapa Δakcje × ΔFX) |
| 🔒 Klucz API lokalnie | Klucz Twelve Data przechowywany w `localStorage`, nigdy nie opuszcza przeglądarki |

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

## Stos technologiczny

- **React 19** + **TypeScript 6**
- **Vite 8** (build + dev server)
- **Tailwind CSS v4**
- **Recharts** (wykresy)
- **Lucide React** (ikony)
- Deployed on **GitHub Pages** via GitHub Actions

---

## Uruchomienie lokalne

```bash
git clone https://github.com/SunBear1/Njord.git
cd Njord
npm install
npm run dev
```

Aplikacja działa bez klucza API (dane giełdowe są niedostępne), ale kurs walutowy i inflacja ładują się automatycznie.

### Zmienne środowiskowe

Utwórz plik `.env.local` (opcjonalnie — dla wbudowanego klucza API):

```env
VITE_TWELVE_DATA_API_KEY=twój_klucz
```

Klucz można też podać bezpośrednio w interfejsie — zostanie zapisany w `localStorage`.
Darmowe konto Twelve Data: 800 zapytań/dzień, 8/minutę → [twelvedata.com/pricing](https://twelvedata.com/pricing)

### Komendy

```bash
npm run dev      # serwer deweloperski (http://localhost:5173/Njord/)
npm run build    # produkcyjny build (tsc + vite)
npm run lint     # ESLint
npm run preview  # podgląd buildu
```

---

## Wdrożenie

Push na `main` automatycznie buduje i deployuje aplikację na GitHub Pages przez `.github/workflows/deploy.yml`.
