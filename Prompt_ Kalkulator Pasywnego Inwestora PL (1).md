Prompt: Kalkulator Pasywnego Inwestora PL

## Kontekst dla AI

Jesteś ekspertem od polskiego rynku finansowego i front-end developmentu. Twoim zadaniem jest zbudowanie kompletnej, single-page aplikacji webowej (HTML + Tailwind CSS + vanilla JS) – Kalkulatora Pasywnego Inwestora PL. Aplikacja ma przeprowadzić użytkownika krok po kroku przez proces budowy portfela inwestycyjnego z uwzględnieniem polskich realiów podatkowych i prawnych.

---

## Dane zewnętrzne (hardcoded – stan na 2025)

Poniższe dane musisz wbudować w aplikację jako stałe konfiguracyjne z możliwością łatwej aktualizacji w jednym miejscu w kodzie:

### Limity IKE/IKZE (rok 2025)

* **IKE**: 26 019 zł/rok (limit na 2025)

* **IKZE pracownik etatowy**: 10 407,60 zł/rok

* **IKZE działalność gospodarcza**: 15 611,40 zł/rok

### Dostępni brokerzy

````
BROKERZY = {
  "XTB": {
    ike: true,
    ikze: false,
    instrumenty: ["ETF", "Akcje PL", "Akcje zagraniczne"],
    prowizja_etf: "0% do 100k EUR obrotu/mies.",
    przewalutowanie: "0.5%",
    uwagi: "Brak IKZE. Najpopularniejszy wybór dla IKE z ETF-ami."
  },
  "DM BOŚ (Bossa)": {
    ike: true,
    ikze: true,
    instrumenty: ["ETF", "Akcje PL", "Akcje zagraniczne"],
```    przewalutowanie: "spread ~0.5%",
    uwagi: "Wygodna integracja z kontem bankowym mBank."
  },
  "Santander BM": {
    ike: true,
    ikze: true,
    instrumenty: ["ETF", "Akcje PL", "Akcje zagraniczne (ograniczone)"],
    prowizja_etf: "0.29% (min 19 PLN) GPW",
    przewalutowanie: "spread ~0.6%",
    uwagi: "Ograniczony dostęp do giełd zagranicznych."
  },
  "BDM": {
    ike: true,
    ikze: true,
    instrumenty: ["ETF", "Akcje PL", "Akcje zagraniczne"],
    prowizja_etf: "0.29% (min 19 PLN) GPW",
    przewalutowanie: "spread ~0.5%",
    uwagi: "Mniejszy broker, ale pełna oferta IKE/IKZE."
  },
  "PKO BP (IKE-Obligacje)": {
    ike: true,
    ikze: true,
    instrumenty: ["Obligacje detaliczne skarbowe"],
    prowizja_etf: "brak – obligacje kupowane bez prowizji",
    przewalutowanie: "nie dotyczy",
    uwagi: "JEDYNY broker umożliwiający zakup obligacji detalicznych w IKE/IKZE. Nie można tu kupić ETF-ów ani akcji."
  }
}

````

### Obligacje detaliczne skarbowe (aktualne oprocentowanie – stan czerwiec 2025)
```
OBLIGACJE = {
  "ROR (roczne zmienne)": {
    okres: "1 rok",
    oprocentowanie: "stopa referencyjna NBP (5.75%) – aktualizowane co miesiąc",
    typ: "zmienne",
    kapitalizacja: "miesięczna"
  },
  "DOR (2-letnie zmienne)": {
    okres: "2 lata",
    oprocentowanie: "stopa referencyjna NBP (5.75%) + 0.25% marży",
    typ: "zmienne",
    kapitalizacja: "miesięczna"
  },
  "TOS (3-miesięczne stałe)": {
    okres: "3 miesiące",
    oprocentowanie: "3.00%",
    typ: "stałe",
    kapitalizacja: "na koniec okresu"
  },
  "DOS (2-letnie stałe)": {
    okres: "2 lata",
    oprocentowanie: "3.25%",
    typ: "stałe",
    kapitalizacja: "na koniec okresu"
  },
  "TOZ (3-letnie zmienne)": {
    okres: "3 lata",
    oprocentowanie: "WIBOR 6M + 0.35% marży",
    typ: "zmienne",
    kapitalizacja: "co 6 miesięcy"
  },
  "COI (4-letnie indeksowane inflacją)": {
    okres: "4 lata",
    oprocentowanie: "pierwszy rok ~6.50%, potem: inflacja CPI + 1.25% marży",
    typ: "indeksowane inflacją",
    kapitalizacja: "roczna"
  },
  "EDO (10-letnie indeksowane inflacją)": {
    okres: "10 lat",
    oprocentowanie: "pierwszy rok ~6.80%, potem: inflacja CPI + 1.50% marży",
    typ: "indeksowane inflacją",
    kapitalizacja: "roczna"
  },
  "ROS (6-letnie rodzinne)": {
    okres: "6 lat",
    oprocentowanie: "inflacja CPI + 2.00%",
    typ: "indeksowane inflacją",
    uwagi: "Tylko dla beneficjentów 800+"
  },
  "ROD (12-letnie rodzinne)": {
    okres: "12 lat",
    oprocentowanie: "inflacja CPI + 2.50%",
    typ: "indeksowane inflacją",
    uwagi: "Tylko dla beneficjentów 800+"
  }
}

```

### Parametry podatkowe
```
PODATKI = {
  belka: 0.19,              // podatek od zysków kapitałowych
  pit_progi: [0.12, 0.32],  // progi PIT (12% do 120k, 32% powyżej)
  pit_liniowy: 0.19,        // PIT liniowy dla DG
  ikze_ryczalt: 0.10,       // podatek przy wypłacie z IKZE
  ike_podatek: 0.00         // 0% Belki przy wypłacie po 60 r.ż.
}

```

### Przykładowe ETF-y dostępne w IKE/IKZE (referencyjne)
```
ETF_REFERENCYJNE = {
  "MSCI World (np. iShares SWDA / Vanguard VWCE)": {
    typ: "Akcje globalne",
    waluta: "USD/EUR",
    historyczna_stopa: "~8-10% rocznie (długoterminowo)",
    ryzyko: "średnie"
  },
  "S&P 500 (np. iShares CSPX / Vanguard VUAA)": {
    typ: "Akcje USA",
    waluta: "USD",
    historyczna_stopa: "~10-12% rocznie",
    ryzyko: "średnie"
  },
  "FTSE All-World (Vanguard VWCE)": {
    typ: "Akcje globalne + EM",
    waluta: "USD",
    historyczna_stopa: "~7-9% rocznie",
    ryzyko: "średnie"
  },
  "WIG20 ETF (Beta ETF WIG20TR)": {
    typ: "Akcje polskie",
    waluta: "PLN",
    historyczna_stopa: "~4-7% rocznie",
    ryzyko: "średnie-wysokie"
  },
  "ETF obligacyjny (np. Beta ETF TBSP)": {
    typ: "Obligacje skarbowe PL",
    waluta: "PLN",
    historyczna_stopa: "~3-5% rocznie",
    ryzyko: "niskie"
  }
}

```

---

## Architektura interfejsu – krok po kroku

Aplikacja działa jako **wieloekranowy wizard** (stepper). Użytkownik przechodzi przez ekrany przyciskami Dalej/Wstecz. Na górze widoczny jest pasek postępu z numerami kroków.

### KROK 0: Dane osobowe

**Cel:** Zebranie danych wpływających na limity i podatki.

**Pola formularza:**

* **Wiek** – input numeryczny (18-99)

* **Stawka PIT** – radio: 12% / 19% liniowy / 32%

* **Działalność gospodarcza** – toggle TAK/NIE (wpływa na limit IKZE)

* **Miesięczna kwota do inwestowania** – input numeryczny w PLN

* **Horyzont inwestycyjny** – slider lub input (1-50 lat)

* **Zakładana inflacja roczna** – input z domyślną wartością 3.5%

**Walidacja:**

* Wiek >= 18

* Kwota > 0

* Horyzont >= 1

**Obliczenia w tle:**

* Roczny budżet = kwota miesięczna \* 12

* Limit IKZE = zależy od statusu DG

* Wyświetl info: "Twój roczny budżet: X zł | Limit IKE: 26 019 zł | Limit IKZE: Y zł"

---

### KROK 1: Wybór brokera IKE

**Cel:** Użytkownik wybiera gdzie ma (lub chce otworzyć) IKE. To determinuje dostępne instrumenty.

**Interfejs:** Karty (cards) z brokerami. Każda karta zawiera:

* Nazwę brokera

* Dostępne instrumenty (ikony/tagi)

* Prowizję

* Krótką uwagę

* Przycisk "Wybieram"

**Opcja:** "Nie chcę korzystać z IKE" – checkbox na dole (pomija krok 2)

**Reguła:** Jeśli wybrano PKO BP IKE-Obligacje → w kroku 2 dostępne TYLKO obligacje detaliczne. Jeśli wybrano XTB/BOŚ/mBank/Santander/BDM → w kroku 2 dostępne ETF-y i akcje.

---

### KROK 1b: Wybór brokera IKZE

**Cel:** Analogiczny do kroku 1, ale dla IKZE.

**Interfejs:** Takie same karty, ale **XTB jest wyszarzone** z adnotacją "XTB nie oferuje IKZE".

**Opcja:** "Nie chcę korzystać z IKZE" – checkbox

**Reguła:** Nie można wybrać tego samego brokera obligacyjnego (PKO BP) dla IKE i IKZE jeśli łączne wpłaty przekroczyłyby sens ekonomiczny – ale technicznie jest to dozwolone.

---

### KROK 2: Budowa portfela IKE

**Cel:** Użytkownik definiuje alokację aktywów w ramach IKE.

**Automatyczne obliczenie:** Roczna wpłata na IKE = min(roczny budżet, 26 019 zł)

**Interfejs zależy od brokera wybranego w kroku 1:**

**Wariant A – IKE-Maklerskie (XTB/BOŚ/mBank/Santander/BDM):**

* Lista instrumentów: ETF-y referencyjne + "Akcje indywidualne PL" + "Akcje zagraniczne"

* Przy każdym instrumencie:

  * Suwak alokacji (0-100%)

  * Input oczekiwanej stopy zwrotu rocznej (z podpowiedzią historycznej)

* **Suwaki muszą sumować się do 100%** – walidacja w czasie rzeczywistym

* Dynamiczny pasek wizualny pokazujący podział portfela (kolorowy bar chart)

**Wariant B – IKE-Obligacje (PKO BP):**

* Lista obligacji detalicznych (EDO, COI, TOS, DOS, TOZ, ROR, DOR)

* Przy każdej obligacji:

  * Suwak alokacji (0-100%)

  * Oprocentowanie jest predefiniowane (ale edytowalne – "Zmień prognozę")

* **Suwaki sumują się do 100%**

* Dla obligacji indeksowanych inflacją → input "Prognozowana inflacja" (domyślnie z kroku 0)

**Wyświetlane informacje:**

* "Wpłata roczna na IKE: 26 019 zł"

* "Podatek przy wypłacie po 60 r.ż.: 0%"

* "Ważona oczekiwana stopa zwrotu portfela IKE: X%"

* Pozostały roczny budżet po IKE: roczny_budżet - wpłata_IKE

---

### KROK 3: Budowa portfela IKZE

**Cel:** Analogiczny do kroku 2, ale dla IKZE.

**Automatyczne obliczenie:** Roczna wpłata na IKZE = min(pozostały_budżet_po_IKE, limit_IKZE)

**Interfejs:** Identyczny jak krok 2 (wariant A lub B w zależności od brokera IKZE).

**Dodatkowe wyświetlane informacje:**

* "Wpłata roczna na IKZE: Y zł"

* "Ulga podatkowa PIT rocznie: Y \* stawka_PIT = Z zł"

* "Podatek przy wypłacie: 10% ryczałt"

* "Czy chcesz reinwestować ulgę podatkową?" – toggle TAK/NIE

  * Jeśli TAK → ulga jest dodawana do rocznego budżetu na nadwyżkę (krok 4)

* Pozostały roczny budżet: roczny_budżet - IKE - IKZE (+ ewentualnie ulga)

---

### KROK 4: Nadwyżka ponad IKE + IKZE

**Cel:** Inwestowanie kwoty przekraczającej limity IKE/IKZE.

**Warunek wyświetlenia:** Ten krok pojawia się TYLKO jeśli pozostały budżet > 0 po kroku 3. W przeciwnym razie – przejdź od razu do kroku 5.

**Automatyczne obliczenie:** Nadwyżka roczna = roczny_budżet - wpłata_IKE - wpłata_IKZE (+ ulga IKZE jeśli reinwestowana)

**Interfejs – wybór koszyka nadwyżki:**

Trzy sekcje z suwakami alokacji (sumujące się do 100%):

**Sekcja A: Obligacje detaliczne (zwykłe konto)**

* Te same obligacje co w IKE-Obligacje

* Adnotacja: "Podatek: 19% Belki od odsetek"

* Suwak alokacji w sekcji A: 0-100%

**Sekcja B: Rachunek maklerski – ETF-y / Akcje**

* Te same ETF-y co w IKE-Maklerskie

* Adnotacja: "Podatek: 19% Belki od zysku przy sprzedaży"

* Suwak alokacji w sekcji B: 0-100%

**Sekcja C: Lokata / konto oszczędnościowe**

* Input oprocentowania (domyślnie 5%)

* Adnotacja: "Podatek: 19% Belki od odsetek"

* Suwak alokacji w sekcji C: 0-100%

**Master suwaki:** Sekcja A + Sekcja B + Sekcja C = 100%

---

### KROK 5: Podsumowanie i wyniki

**Cel:** Prezentacja kompletnej projekcji kapitału.

**Sekcja 1 – Wykres liniowy (Chart.js lub vanilla canvas):**

* Oś X: lata (0 do horyzont)

* Oś Y: wartość kapitału w PLN

* Linie:

  * IKE (kolor zielony)

  * IKZE (kolor niebieski)

  * Nadwyżka (kolor pomarańczowy)

  * SUMA (kolor czarny, gruba linia)

  * Suma wpłat (kolor szary, przerywana – dla porównania)

* Tooltip: po najechaniu na rok – szczegóły

**Sekcja 2 – Tabela roczna (rozwijana):**

Kolumny:

* Rok

* Wpłaty IKE | Wartość IKE

* Wpłaty IKZE | Wartość IKZE | Ulga PIT

* Wpłaty nadwyżka | Wartość nadwyżka

* Suma wpłat | Suma wartość

* Zysk skumulowany

**Sekcja 3 – Kluczowe metryki (karty):**

* **Suma wpłat**: łączna kwota wpłacona

* **Wartość portfela (brutto)**: przed podatkami na wypłacie

* **Oszczędność podatkowa IKE**: ile zaoszczędzono dzięki braku Belki

* **Łączna ulga IKZE**: suma ulg PIT przez lata

* **Podatek IKZE przy wypłacie (10%)**: ile zapłacisz na koniec

* **Podatek Belki (nadwyżka)**: ile zapłacisz od zysków poza IKE/IKZE

* **Wartość NETTO po podatkach**: finalna kwota

* **Wartość realna (po inflacji)**: zdyskontowana o inflację

* **Efektywna roczna stopa zwrotu netto**: CAGR netto

**Sekcja 4 – Porównanie scenariuszy:**

* "Co gdyby wszystko było na zwykłym koncie maklerskim?" → pokaż różnicę

* "Ile zyskujesz dzięki IKE + IKZE?" → kwota zaoszczędzona na podatkach

---

## Matematyka – wzory do implementacji

### Przyszła wartość z regularnymi wpłatami (FV annuity)
```
FV = PMT * ((1 + r)^n - 1) / r

```

Gdzie:

* PMT = wpłata miesięczna (lub roczna – ujednolić do miesięcznej)

* r = miesięczna stopa zwrotu = (1 + roczna_stopa)^(1/12) - 1

* n = liczba miesięcy

### Ważona stopa zwrotu portfela
```
r_portfela = Σ (alokacja_i * stopa_i) dla i w instrumentach

```

### Wartość netto IKZE
```
netto_ikze = brutto_ikze * (1 - 0.10)

```

### Wartość netto nadwyżki (Belka)
```
zysk = wartość_końcowa - suma_wpłat
podatek = zysk * 0.19
netto = wartość_końcowa - podatek

```

### Ulga IKZE rocznie
```
ulga = wpłata_ikze * stawka_pit

```

### Wartość realna (po inflacji)
```
wartość_realna = wartość_nominalna / (1 + inflacja)^lata

```

### Obligacje indeksowane inflacją (EDO/COI)
```
oprocentowanie_rok_N = inflacja_CPI + marża
wartość = wartość_poprzednia * (1 + oprocentowanie_rok_N)

```

---

## Wymagania techniczne

* **Single HTML file** – wszystko w jednym pliku (HTML + CSS + JS)

* **Tailwind CSS** via CDN

* **Chart.js** via CDN (dla wykresu)

* **Responsywny design** – mobile-first

* **Język interfejsu**: polski

* **Waluta**: PLN (formatowanie z separatorem tysięcy: 1 000 000 zł)

* **Brak backendu** – wszystkie obliczenia client-side

* **Brak ciasteczek / localStorage** – opcjonalnie do zapisu stanu

* **Dostępność**: aria-labels, fokus na klawiaturze, kontrast AA

---

## Reguły biznesowe (walidacja)

1. Użytkownik może mieć **tylko jedno IKE** i **tylko jedno IKZE**

2. Na IKE-Obligacje (PKO BP) **nie można kupić ETF-ów ani akcji**

3. Na IKE-Maklerskie **nie można kupić obligacji detalicznych**

4. **XTB nie oferuje IKZE** – musi być wyszarzone w kroku 1b

5. Suma alokacji w każdym portfelu musi wynosić **dokładnie 100%**

6. Wpłata na IKE nie może przekroczyć limitu rocznego

7. Wpłata na IKZE nie może przekroczyć limitu rocznego

8. Jeśli roczny budżet < limit IKE → cały budżet idzie na IKE, nic na IKZE

   * ALE: użytkownik powinien mieć opcję ręcznego podziału (toggle "Chcę sam podzielić budżet między IKE a IKZE")

9. Obligacje rodzinne (ROS/ROD) – dodatkowy warunek: toggle "Czy jesteś beneficjentem 800+?"

---

---

## Przykładowy scenariusz testowy

Użytkownik:

* Wiek: 30, PIT: 32%, DG: NIE

* Miesięcznie: 4 000 zł (rocznie: 48 000 zł)

* Horyzont: 30 lat

* Inflacja: 3.5%

Oczekiwany flow:

1. IKE na XTB → 26 019 zł/rok → portfel: 80% MSCI World (9%), 20% S&P 500 (11%)

2. IKZE na DM BOŚ → 10 407,60 zł/rok → portfel: 100% MSCI World (9%)

3. Nadwyżka: 48 000 - 26 019 - 10 407,60 = 11 573,40 zł/rok → 50% EDO, 50% ETF na zwykłym rachunku

4. Ulga IKZE: 10 407,60 \* 0.32 = 3 330,43 zł/rok → reinwestowana

Wynik po 30 latach powinien pokazać kwotę rzędu 5-8 mln zł nominalnie (do weryfikacji przez kalkulator).