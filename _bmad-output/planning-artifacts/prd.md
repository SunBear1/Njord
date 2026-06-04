---
workflowType: 'prd'
workflow: 'edit'
date: '2026-05-11'
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-e-01-discovery
  - step-e-02-review
  - step-e-03-edit
inputDocuments:
  - docs/backtest-methodology.md
  - docs/financial-methodology.md
documentCounts:
  productBriefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 2
classification:
  projectType: web_app
  domain: "decision-support fintech"
  complexity: high
  projectContext: brownfield
releaseMode: phased
lastEdited: '2026-05-18'
editHistory:
  - date: '2026-05-18'
    changes: 'Merged duplicate scope sections, sharpened FR20/FR38 acceptance criteria, added per-item testability to borderline NFRs (accessibility assistive tech, degradation mode).'
  - date: '2026-05-11'
    changes: 'Added compliance control frame, recurring and abuse journeys, measurable NFRs, phase anchors, and frontmatter cleanup.'
---

# Dokument wymagan produktowych - Njord

**Autor:** Master
**Data:** 2026-05-11

## Executive Summary

Njord ma ewoluowac z zestawu kalkulatorow inwestycyjnych w cockpit decyzyjny dla polskiego inwestora. Celem produktu jest radykalne obnizenie kosztu czasu, niepewnosci i ryzyka bledu przy decyzji, gdzie ulokowac pieniadze, poprzez polaczenie agregacji portfela i pozycji z wielu brokerow z warstwa analityczno-decyzyjna uwzgledniajaca polskie podatki, kursy walut, inflacje oraz lokalne alternatywy inwestycyjne.

Produkt jest kierowany do polskich inwestorow samodzielnie zarzadzajacych kapitalem, ktorzy dzis skladaja odpowiedz z wielu rozproszonych zrodel i w efekcie traca czas, wpadaja w paraliz decyzyjny oraz boja sie kosztownych bledow podatkowych, walutowych i alokacyjnych. Pierwszym kluczowym use case'em powinno byc wsparcie decyzji, gdzie ulokowac nowa gotowke lub kolejna wplate, tak aby decyzja byla sensowna po podatku, FX i wzgledem polskich alternatyw.

Jednoczesnie model monetyzacji nie moze opierac sie na obietnicy "potencjalnie wiecej zarobisz, wiec zaplac". Najpierw Njord musi zbudowac zaufanie poprzez rzetelnosc, przejrzystosc metodologii i realna oszczednosc czasu. Dopiero po udowodnieniu tej wartosci uzytkownik bedzie gotow rozwazyc platnosc za dodatkowe funkcjonalnosci premium, takie jak glebsza personalizacja, monitoring, automatyzacja rozliczen czy zaawansowane scenariusze decyzyjne.

### Co wyroznia produkt

Njord ma wygrywac nie sama agregacja danych, lecz przejsciem od rozproszonych danych do jasnej rekomendacji. Uzytkownik ma otrzymac jedno przejrzyste miejsce pokazujace pelniejszy obraz portfela oraz odpowiedz, co bardziej oplaca sie zrobic teraz i dlaczego. To przesuwa produkt z roli kalkulatora do roli decision engine zbudowanego na fundamencie zaufania.

Najwazniejszym wyroznikiem jest polaczenie czterech warstw w jednym przeplywie: agregacji portfela z wielu miejsc, porownania opcji alokacji, wyniku po podatku i FX oraz monitoringu zmian, gdy rekomendacja przestaje byc najlepsza. W dalszym rozwoju istotnym elementem przewagi moze byc takze automatyzacja rozliczen Belki i PIT jako warstwa zaufania i oszczednosci czasu, ale dopiero po zbudowaniu wiarygodnosci rdzenia produktu.

## Klasyfikacja projektu

- **Project Type:** web app
- **Domain:** decision-support fintech
- **Complexity:** high
- **Project Context:** brownfield

To jest projekt brownfield, bo Njord juz istnieje jako SPA z rozwinieta warstwa obliczen finansowych. PRD nie opisuje budowy produktu od zera, lecz jego ukierunkowana ewolucje w strone produktu, za ktory uzytkownik realnie chce placic po zbudowaniu zaufania.

## Success Criteria

### Sukces uzytkownika

Uzytkownik w mniej niz 5 minut przechodzi od wejscia do produktu do decyzji inwestycyjnej, ktora wydaje sie wiarygodna i jest zrozumiala. Widzi skonsolidowany obraz portfela i pozycji, rozumie dlaczego dana rekomendacja zostala pokazana oraz zna jej sens po podatku i FX. Sesja konczy sie jasnym wynikiem: uzytkownik wie, co zrobic z nowa gotowka, kolejna wplata lub konczaca sie lokata.

Sukces uzytkownika oznacza takze zaufanie do wyniku. Produkt nie moze byc tylko informacyjny; musi byc na tyle wiarygodny, aby uzytkownik realnie oprzec na nim decyzje. Docelowo oznacza to, ze znaczaca czesc aktywowanych uzytkownikow postepuje zgodnie z rekomendacja Njorda, zamiast traktowac ja jako ciekawostke.

### Sukces biznesowy

W krotkim horyzoncie sukces oznacza, ze Njord przestaje byc narzedziem jednorazowym i zaczyna pelnic role miejsca, do ktorego uzytkownik wraca regularnie. Docelowy sygnal na tym etapie to 30% miesiecznego powrotu aktywowanych uzytkownikow do kolejnej sesji decyzyjnej, a po wdrozeniu warstwy monitoringu takze do flow monitoringu i weryfikacji poprzedniej decyzji.

W srednim horyzoncie produkt wygrywa wtedy, gdy uzytkownik po pierwszym trafnym lub uzytecznym doswiadczeniu wraca do Njorda przy kolejnych decyzjach, zamiast ponownie rozpraszac sie miedzy wieloma zrodlami. Dodatkowym sygnalem biznesowym jest to, ze 60% aktywowanych uzytkownikow ufa rekomendacji na tyle, aby dzialac zgodnie z nia.

Monetyzacja jest wtorna wobec zaufania. Produkt nie powinien probowac sprzedawac sie obietnica potencjalnego zysku, lecz udowodniona oszczednoscia czasu, wiekszym spokojem decyzyjnym oraz dodatkowymi funkcjami premium, gdy rdzen okaze sie wiarygodny. Zaufanie i gotowosc do platnosci pozostaja hipotezami walidacyjnymi do mierzenia na bazie zachowan uzytkownika, a nie samodzielna obietnica MVP.

### Sukces techniczny

Rdzen produktu musi dzialac w standardzie zero critical errors dla rekomendacji inwestycyjnych i warstwy podatkowej. Jesli uzytkownik otrzyma oczywiscie zla, ryzykowna albo niespojna rekomendacje, utrata zaufania bedzie praktycznie nieodwracalna.

Techniczny sukces oznacza wiec: poprawne i audytowalne obliczenia, wiarygodne pokazanie wyniku po podatku i FX, czytelna agregacje pozycji, jasne uzasadnienie rekomendacji oraz przeplyw decyzyjny, ktory realnie miesci sie w mniej niz 5 minutach. Produkt powinien tez jasno komunikowac zalozenia, zrodla danych i granice pewnosci rekomendacji.

### Wymierne rezultaty

- Czas od wejscia do uzyskania rekomendacji: < 5 min
- Miesieczny powrot aktywowanych uzytkownikow do kolejnej sesji decyzyjnej lub monitoringu (Journey 5): 30%
- Odsetek aktywowanych uzytkownikow dzialajacych zgodnie z rekomendacja mozliwa do wykonania: 60%
- Krytyczne bledy w rdzeniu rekomendacji / podatkow: 0
- Kazda rekomendacja zawiera uzasadnienie oraz wplyw podatku i FX

### Definicje pomiaru

- **Aktywowany uzytkownik:** uzytkownik, ktory zakonczyl pierwsza pelna sesje decyzyjna z widoczna rekomendacja albo wynikiem typu no-action / conditional outcome oraz uzasadnieniem wyniku.
- **Powrot:** wejscie w kolejna sesje decyzyjna albo recurring-user / monitoring journey w ciagu 30 dni od aktywacji.
- **Dzialanie zgodnie z rekomendacja:** jawne potwierdzenie, zapis decyzji albo przejscie do wykonania rekomendowanej opcji w przeplywie, w ktorym rekomendacja nie byla oznaczona jako warunkowa lub poza zakresem.

## Product Scope

Szczegolowe fazowanie, zakres capability, traceability i strategia ryzyka sa opisane w sekcji "Scoping projektu i fazowanie" ponizej. Ponizej jedynie kierunkowe podsumowanie faz:

- **Faza 1 (Platform MVP):** Agregacja portfela, manual-first holdings, recommendation engine z explainability, wynik po podatku i FX, confidence basics, audit trail.
- **Faza 2 (Post-MVP):** Monitoring dashboard, alerty, Belka/PIT automation, scenario history, goal-based recommendations, integracje brokerow.
- **Faza 3 (Wizja):** Proaktywny investment copilot — event-driven guidance, glebsza personalizacja, ciagla optymalizacja momentow decyzyjnych.

## User Journeys

### 1. Primary User - Success Path: Michal podejmuje decyzje o nowej wplacie

**Opening Scene:**  
Michal ma 34 lata, inwestuje samodzielnie i po kazdej wyplacie odklada czesc pieniedzy. Ma juz troche ETF-ow, troche akcji i troche gotowki na roznych rachunkach. Zna rynek na tyle, by rozumiec podstawy, ale nie chce za kazdym razem skladac decyzji z Yahoo Finance, kursow walut, Excela i wlasnych notatek.

**Rising Action:**  
Otwiera Njord, widzi skonsolidowany obraz swoich pozycji i nowej gotowki do ulokowania. Uzupelnia lub importuje holdings, okresla podstawowe preferencje, a produkt pokazuje kilka sensownych opcji: np. ETF, obligacje, konto oszczednosciowe, IKE/IKZE. Kazda opcja jest pokazana po podatku, FX i w kontekscie jego aktualnego portfela.

**Climax:**  
Njord pokazuje jedna glowna rekomendacje i wyjasnia, dlaczego wlasnie ta decyzja jest dzis najbardziej sensowna. Michal nie widzi tylko wyniku, ale tez logike: wplyw podatku, ryzyka, kursu walut i lokalnych alternatyw.

**Resolution:**  
W mniej niz 5 minut Michal wie, co zrobic z nowa wplata. Nie czuje chaosu ani potrzeby dalszego googlowania. Zamyka sesje z poczuciem, ze podjal rozsadna decyzje szybciej i pewniej niz zwykle.

### 2. Primary User - Edge Case: Anna ma konflikt danych i niski poziom zaufania

**Opening Scene:**  
Anna ma 41 lat, inwestuje od lat i jest ostrozna. Ma srodki u kilku brokerow, konczy jej sie lokata i chce szybko zdecydowac, co zrobic dalej. Problem w tym, ze dane sa rozproszone, a ona ma niski prog tolerancji na blad - jedna zla rekomendacja i produkt dla niej przestaje istniec.

**Rising Action:**  
Anna laduje dane, ale Njord wykrywa niescislosc: brakujaca pozycje, konflikt kursow albo niepelny obraz portfela. Zamiast udawac pewnosc, produkt jasno pokazuje, gdzie jest problem, czego brakuje i jak go naprawic. Anna moze poprawic dane recznie albo zdecydowac, ze chce rekomendacje tylko w oparciu o potwierdzone informacje.

**Climax:**  
Po korekcie Njord nie daje "magicznej odpowiedzi", tylko zaufana rekomendacje z widocznymi zalozeniami i granica pewnosci. Jesli pewnosc jest zbyt niska, produkt woli to zakomunikowac niz wygenerowac glupia sugestie.

**Resolution:**  
Anna albo podejmuje decyzje swiadomie, albo odklada ja z poczuciem, ze produkt zachowal sie uczciwie. W tym journey sukces nie polega tylko na rekomendacji, ale na ochronie zaufania w sytuacji niepewnosci.

### 3. Admin / Operations User: Kamil pilnuje jakosci rekomendacji

**Opening Scene:**  
Kamil odpowiada po stronie produktu za jakosc danych, logiki rekomendacji i guardrailow. Wie, ze w decision-support fintech nie ma miejsca na ciche bledy, bo nawet pojedyncza zla rekomendacja moze zniszczyc wiarygodnosc produktu.

**Rising Action:**  
Kamil monitoruje sygnaly jakosci: swiezosc danych, spojnosc obliczen, nietypowe wyniki, wzrost liczby rekomendacji odrzuconych przez userow albo przypadki, w ktorych system pokazuje zbyt wysoka pewnosc przy niepelnych danych. Widzi tez, ktore flow najczesciej koncza sie porzuceniem lub reczna korekta.

**Climax:**  
Kiedy pojawia sie ryzyko blednych wynikow - np. problem z danymi brokera, zle mapowanie pozycji albo podejrzana logika rekomendacji - Kamil moze szybko ograniczyc dzialanie danego mechanizmu, obnizyc poziom pewnosci, oznaczyc rekomendacje jako wymagajace ostroznosci lub czasowo wylaczyc wadliwy fragment.

**Resolution:**  
Produkt zachowuje zaufanie, bo nie probuje byc pewny na sile. Kamil nie "zarzadza tabelkami"; zarzadza wiarygodnoscia systemu i zmniejsza ryzyko, ze uzytkownik dostanie zla odpowiedz.

### 4. Support / Troubleshooting: Ewa wyjasnia uzytkownikowi, skad wziela sie rekomendacja

**Opening Scene:**  
Ewa pracuje po stronie wsparcia lub operacyjnego customer success. Dostaje wiadomosc od uzytkownika: "Njord polecil mi X, ale nie rozumiem dlaczego" albo "moja pozycja wyglada inaczej niz u brokera".

**Rising Action:**  
Ewa otwiera slad decyzji: widzi dane wejsciowe, przyjete zalozenia, uzyte kursy, wplyw podatku, wykryte niescislosci i finalna rekomendacje. Nie musi zgadywac, co system zrobil, bo moze odtworzyc tok decyzji i wskazac uzytkownikowi dokladny punkt problemu.

**Climax:**  
Jesli problem wynika z niepelnych danych lub bledu importu, Ewa moze poprowadzic uzytkownika przez naprawe. Jesli problem lezy w niezrozumieniu wyniku, potrafi wyjasnic go w prosty sposob. Jesli to realny blad produktu, przekazuje go dalej z pelnym kontekstem technicznym i biznesowym.

**Resolution:**  
Uzytkownik nie zostaje z poczuciem, ze "algorytm cos wymyslil". Zamiast tego odzyskuje zaufanie albo przynajmniej dostaje transparentne wyjasnienie, dlaczego produkt zachowal sie w okreslony sposob.

### 5. Returning User - Monitoring Path: Michal wraca do Njorda, by sprawdzic czy poprzednia decyzja nadal ma sens

**Opening Scene:**  
Minelo kilka tygodni od ostatniej decyzji. Michal ma juz zapisany punkt odniesienia, ale rynek, FX albo jego portfel zdazyly sie zmienic. Nie chce zaczynac analizy od zera; chce szybko zobaczyc, czy powinien utrzymac kurs, cos skorygowac albo przygotowac kolejny ruch.

**Rising Action:**  
Po wejsciu do Njorda widzi monitoring poprzedniej decyzji: co zmienilo sie od ostatniej sesji, czy rekomendacja nadal wyglada sensownie, jakie alerty sie pojawily i ktore zalozenia przestaly byc aktualne. Moze wejsc w historie rekomendacji, porownac obecny stan z poprzednim baseline'em i przejsc z monitoringu do kolejnej decyzji bez recznego skladania kontekstu od nowa.

**Climax:**  
Njord pokazuje, czy poprzednia decyzja pozostaje zasadna, czy pojawil sie powod do zmiany: np. istotna zmiana FX, relacji ryzyka do wyniku netto, nowa gotowka albo zmiana jakosci rekomendacji. Jesli sygnal jest zbyt slaby, produkt nie wymusza ruchu; pokazuje monitoruj dalej zamiast sztucznej akcji.

**Resolution:**  
Michal w kilka chwil rozumie, czy ma utrzymac poprzedni plan, wejsc w nowa decyzje czy po prostu obserwowac sytuacje. To jest moment, w ktorym Njord przestaje byc jednorazowym kalkulatorem i staje sie narzedziem, do ktorego warto wracac regularnie.

### 6. Risk / Abuse Operations User: Marta wykrywa naduzycie i chroni wiarygodnosc produktu

**Opening Scene:**  
Marta odpowiada za ryzyko operacyjne, bezpieczenstwo i granice uzycia produktu. Wie, ze w decision-support fintech zagrozeniem nie jest tylko blad modelu, ale tez naduzycie: nietypowe wzorce dostepu, proby wymuszenia zbyt pewnej rekomendacji, masowe odpytania albo dzialania, ktore moga naruszyc dane lub wiarygodnosc wyniku.

**Rising Action:**  
System pokazuje sygnaly ostrzegawcze: podejrzanie wysoka liczbe prob, nietypowe sekwencje zmian danych, wzorce wskazujace na scraping, probing albo obchodzenie guardrailow. Marta widzi, ktore konto, sesja albo mechanizm zachowuje sie poza norma i ma dostep do sladu zdarzen potrzebnego do szybkiej oceny ryzyka.

**Climax:**  
Gdy ryzyko rosnie, Marta moze ograniczyc problematyczny przeplyw: obnizyc poziom zaufania, wstrzymac generowanie rekomendacji, oznaczyc przypadek do review, zawezc dostep albo czasowo zablokowac fragment funkcji. Produkt ma preferowac brak rekomendacji i ochrone danych nad obsluge podejrzanego ruchu za wszelka cene.

**Resolution:**  
Njord pozostaje wiarygodny, bo umie bronic nie tylko poprawnosci logiki, ale tez granic swojego uzycia. Marta nie walczy o metryki vanity; chroni zaufanie, dane i operacyjna integralnosc produktu.

### Podsumowanie wymaganych zdolnosci

Te journeys ujawniaja potrzebe kilku kluczowych capability areas:
- agregacja portfela i pozycji z wielu zrodel,
- import i reczna korekta danych,
- decision engine z uzasadnieniem rekomendacji,
- wynik po podatku i FX,
- sygnalizowanie poziomu pewnosci i brakow danych,
- obsluga edge case'ow bez utraty zaufania,
- monitoring zmian, alerty i historia rekomendacji / scenariuszy,
- podtrzymanie kontekstu miedzy sesjami oraz plynne przejscie z monitoringu do kolejnej decyzji,
- operacyjny monitoring jakosci rekomendacji,
- wykrywanie naduzyc, ograniczanie ryzyka i ochrona danych / wiarygodnosci,
- traceability dla supportu, audytu i wyjasnienia wyniku.

## Domain-Specific Requirements

### Granice prawne i jurysdykcyjne

- Njord jest produktem **wsparcia decyzji**: dostarcza porownan, estymacji, symulacji i objasnien. Nie stanowi doradztwa inwestycyjnego, rekomendacji indywidualnej, zarzadzania portfelem, posrednictwa w zawieraniu transakcji ani obietnicy wyniku.
- Domyslny zakres merytoryczny dotyczy uzytkownika dzialajacego w **polskim kontekscie podatkowym i produktowym**. Kazdy wynik wykraczajacy poza ten zakres musi byc jednoznacznie oznaczony jako poza zakresem, warunkowy albo niedostepny.
- Produkt nie moze sugerowac, ze zastepuje licencjonowana porade prawna, podatkowa lub inwestycyjna. Komunikacja musi utrzymywac rozroznienie miedzy **informacja**, **symulacja** i **rekomendacja regulowana**.
- Jezeli zakres prawny, kompletnosc danych wejsciowych lub wiarygodnosc danych sa niewystarczajace, system ma **ograniczac pewnosc wnioskow**, eksponowac zastrzezenia i powstrzymywac sie od prezentowania wynikow jako pelnych lub definitywnych.

### Matryca zgodnosci

| Wymog | Kontrola / oczekiwany rezultat | Wlasciciel | Dowod | Weryfikacja |
|---|---|---|---|---|
| Granica prawna produktu | Kazdy kluczowy przeplyw i wynik utrzymuje pozycjonowanie "wsparcie decyzji, nie porada regulowana" | Product + Legal/Compliance | Aktualne tresci graniczne, rejestr akceptacji, przeglad copy | Przeglad przed wydaniem i cykliczny |
| Zakres jurysdykcyjny | Wyniki sa prezentowane wylacznie w ramach jawnie okreslonego zakresu Polski; wyjatki sa oznaczane lub blokowane | Product + Legal/Compliance | Rejestr zakresow, lista wyjatkow, decyzje akceptacyjne | Przeglad zmian zakresu i testy akceptacyjne |
| Bezpieczenstwo i prywatnosc | Dane uzytkownika, uprawnienia i dzialania uprzywilejowane podlegaja minimalizacji, kontroli dostepu i rozliczalnosci | Security/Privacy | Rejestr kontroli, oceny ryzyka, potwierdzenia przegladow dostepu | Przeglad okresowy i po incydencie |
| Audit i rozliczalnosc | Kazdy istotny wynik mozna odtworzyc z danych wejsciowych, zrodel, wersji regul, poziomu pewnosci i ostrzezen | Product + Risk/Operations | Slad audytowy, historia zmian, rejestr wyjatkow | Probkowanie cykliczne i przeglad sporow / incydentow |
| Ograniczenie naduzyc | Naduzycia, manipulacje i proby obchodzenia granic produktu sa wykrywane, ograniczane i eskalowane | Risk/Fraud | Rejestr zdarzen, decyzje eskalacyjne, historia blokad / wyjatkow | Monitoring operacyjny i przeglad trendow |
| Integralnosc danych finansowych | Kazda dana finansowa ma pochodzenie, czas obowiazywania, status jakosci i proces korekty wplywu | Data Governance + Product | Katalog zrodel, rejestr korekt, komunikaty o wplywie | Uzgodnienia okresowe i przeglad korekt materialowych |

### Baseline bezpieczenstwa i ochrony danych

- Zakres danych osobowych i finansowych przetwarzanych przez produkt musi byc ograniczony do **minimum niezbednego** dla dzialania, wsparcia uzytkownika i rozliczalnosci.
- Dane wprowadzone recznie przez uzytkownika sa dopuszczalne, ale musza pozostawac **odroznialne od danych potwierdzonych** oraz nie moga uzyskiwac domyslnego statusu "zweryfikowane".
- Dostep do funkcji uprzywilejowanych, zmian tresci granicznych, regul biznesowych i danych referencyjnych musi byc ograniczony do uprawnionych rol oraz podlegac udokumentowanemu przegladowi.
- Produkt musi zapewniac ochrone poufnosci, integralnosci i dostepnosci danych adekwatna do ryzyka oraz posiadac zdefiniowana sciezke obslugi incydentow bezpieczenstwa i prywatnosci.
- Komunikacja z uzytkownikiem ma jasno rozrozniac dane zrodlowe, dane deklaratywne, wyniki obliczen i poziom pewnosci.

### Wymagania auditowe i dowodowe

- Kazdy istotny wynik, porownanie lub ostrzezenie musi posiadac **slad dowodowy** obejmujacy co najmniej: uzyte dane wejsciowe, zrodla danych, moment obowiazywania danych, wersje regul / zalozen, poziom pewnosci, zastrzezenia oraz istotne dzialania uzytkownika.
- Zmiany majace wplyw na interpretacje wynikow - w szczegolnosci reguly finansowe, tresci graniczne, klasyfikacje jakosci danych i logike pewnosci - musza posiadac wlasciciela biznesowego, date obowiazywania i dowod zatwierdzenia.
- Produkt musi wspierac **odtwarzalnosc** wyniku dla celow przegladu wewnetrznego, obslugi reklamacji, analizy incydentu oraz obrony przed bledna interpretacja dzialania produktu.
- Gdy poziom pewnosci spada ponizej ustalonego progu, wynik musi byc odpowiednio ograniczony, oznaczony lub wstrzymany; decyzja ta rowniez podlega udokumentowaniu.

### Zapobieganie fraudom i naduzyciom

- Produkt musi ograniczac ryzyko wykorzystania go do tworzenia **mylacych twierdzen inwestycyjnych**, falszywego wrazenia gwarancji wyniku albo obchodzenia granicy miedzy informacja a porada regulowana.
- Nietypowe, sprzeczne lub niewiarygodne dane wejsciowe oraz wzorce uzycia wskazujace na manipulacje, masowe naduzycie lub probe obejscia ograniczen musza skutkowac adekwatna reakcja: ograniczeniem funkcji, dodatkowymi ostrzezeniami, eskalacja lub blokada.
- Nadpisania, wyjatki i korekty o istotnym wplywie nie moga byc anonimowe; musza byc przypisane do wlasciciela i zabezpieczone dowodowo.
- Produkt nie moze prezentowac danych deklaratywnych uzytkownika jako niezaleznie potwierdzonych ani ukrywac wplywu brakow danych na wynik.

### Integralnosc danych finansowych i governance korekt

- Kazda materialna dana finansowa uzyta w produkcie musi posiadac **udokumentowane pochodzenie**, zakres zastosowania, date / czas obowiazywania, status jakosci i wlasciciela odpowiedzialnego za jej uzycie.
- W przypadku konfliktu, nieaktualnosci lub niekompletnosci danych produkt ma zachowywac sie **bezpiecznie**: ujawniac ograniczenie, obnizac pewnosc, wstrzymywac wynik lub oznaczac go jako wymagajacy ostroznosci; nie moze ukrywac niepewnosci.
- Korekty danych, regul lub klasyfikacji jakosci musza byc zarzadzane formalnie: z okresleniem przyczyny, zakresu wplywu, wlasciciela, daty obowiazywania i decyzji o komunikacji do uzytkownika.
- Materialne korekty wplywajace na wczesniejsze wyniki musza uruchamiac ponowna ocene wplywu, odpowiednia aktualizacje wynikow / ostrzezen oraz zachowanie historii przed korekta dla celow audytu.
- Governance danych finansowych musi obejmowac okresowy przeglad zrodel, jakosci, kompletnosci i zgodnosci zakresu danych z deklarowanym zastosowaniem produktu.

## Innowacja i nowe wzorce

### Wykryte obszary innowacji

Innowacja Njorda nie polega na nowej technologii webowej, tylko na nowym sposobie organizacji decyzji inwestycyjnej polskiego inwestora. Produkt laczy agregacje portfela, lokalny kontekst podatkowo-FX, explainability oraz zarzadzanie niepewnoscia w jeden przeplyw prowadzacy do kolejnego ruchu uzytkownika.

Najmocniejszym wykrytym wzorcem innowacji jest kierunek next-best-action engine: system, ktory nie tylko pokazuje dane, ale rozpoznaje moment decyzyjny i odpowiada, co jest najrozsadniejszym kolejnym ruchem wlasnie teraz. Drugim wyroznikiem jest uczciwe zarzadzanie niepewnoscia - Njord powinien potrafic jasno pokazac poziom pewnosci, braki danych i sytuacje, w ktorych lepiej nie rekomendowac ruchu niz udawac precyzje.

Trzecim obszarem innowacji jest potraktowanie ograniczen integracyjnych jako czesci przewagi produktu. Zamiast uzalezniac wartosc od pelnych API brokerow, Njord moze wygrac przez manual-first portfolio unification zaprojektowane tak dobrze, by uzytkownik nadal dostawal spojna wartosc decyzyjna.

### Kontekst rynkowy i konkurencja

Dzisiejszy krajobraz uzytkownika jest rozproszony: broker pokazuje pozycje, inne narzedzie liczy podatek, inne pokazuje kurs walut, a decyzja i tak powstaje recznie w glowie uzytkownika lub w Excelu. Alternatywy konkuruja glownie na poziomie danych, ekranow lub pojedynczych kalkulatorow.

Hipoteza konkurencyjna Njorda jest inna: uzytkownik nie potrzebuje kolejnego zrodla danych, lecz systemu, ktory laczy rozproszony obraz portfela z lokalnym kontekstem i zamienia go w wiarygodny kolejny krok. To jest roznica kategorii produktu, a nie tylko roznica zestawu funkcji.

### Podejscie walidacyjne

Te innowacje nalezy walidowac przez zachowanie uzytkownika, a nie deklaracje. Kluczowe pytania walidacyjne to:
- czy uzytkownik dochodzi do decyzji szybciej,
- czy ufa rekomendacji bardziej, gdy widzi explainability,
- czy jawne komunikowanie niepewnosci zwieksza zaufanie zamiast je obnizac,
- czy model manual-first daje wystarczajaca wartosc bez pelnych integracji brokerow.

W praktyce walidacja powinna zaczac sie od manual decision session, potem przejsc do monitoringu, a dopiero pozniej do bardziej proaktywnego copilotowego zachowania.

### Ograniczanie ryzyka

Najwiekszym ryzykiem jest innovation theater - zbyt duza obietnica "copilota", zanim produkt opanuje zaufana, pojedyncza sesje decyzyjna. Dlatego fallback powinien byc jasny: jesli event-driven copilot okaze sie za szeroki, produkt wraca do prostszego modelu: najpierw decyzja reczna, potem monitoring, dopiero potem proaktywnosc.

Drugim ryzykiem jest mylenie nowosci z agresywna rekomendacja. Njord nie powinien probowac byc innowacyjny przez wieksza pewnosc komunikacji, tylko przez lepsze polaczenie agregacji, local context i jawnej granicy modelu.

## Wymagania specyficzne dla aplikacji webowej

### Kontekst typu produktu

Njord nalezy traktowac jako brownfield web application z obecnym baseline'em w postaci SPA, bez zamykania drogi do przyszlych zmian architektonicznych. Produkt ma dostarczac szybki, zaufany flow decyzyjny w przegladarce, z lekkim odswiezaniem danych rynkowych, ale bez potrzeby pelnego real-time.

Oficjalne wsparcie powinno obejmowac ostatnie 2 wersje glownych przegladarek uzywanych przez docelowego uzytkownika. SEO jest wazne na poziomie stron wejsciowych, opisowych i edukacyjnych, ale nie stanowi rdzenia doswiadczenia decyzyjnego. Accessibility ma byc traktowane jako element zaufania produktu, a nie dodatku.

### Uwagi architektoniczne

Architektura webowa musi wspierac szybkie przejscie od wejscia do rekomendacji bez przeladowan i bez poczucia "ciecia sie" interfejsu. Poniewaz produkt operuje na danych finansowych i wrazliwych danych portfelowych, warstwa prezentacji musi byc projektowana z naciskiem na czytelnosc, stan danych, explainability i odpornosc na czesciowe lub opoznione odpowiedzi z integracji rynkowych.

Lekki real-time nalezy rozumiec jako odswiezanie lub polling tam, gdzie wplywa to na trafnosc decyzji, a nie jako ciagly live-feed. Priorytetem jest spojnosc i wiarygodnosc widoku nad "ruchliwoscia" interfejsu.

### Macierz wsparcia przegladarek

- Oficjalny support: ostatnie 2 wersje glownych przegladarek
- Produkt musi dzialac stabilnie w nowoczesnych przegladarkach desktop i mobile
- Roznice miedzy przegladarkami nie moga wplywac na poprawnosc rekomendacji, podatkow ani prezentacji kluczowych danych portfelowych

### Responsywnosc

Responsive design jest krytyczny. Produkt musi byc wygodny na mobile, tablet i desktop, bez utraty czytelnosci danych finansowych, porownan i uzasadnienia rekomendacji. Szczegolna uwage trzeba poswiecic ekranom, na ktorych uzytkownik porownuje opcje, analizuje wplyw podatku i podejmuje decyzje - to tam responsywnosc nie moze degradowac zaufania.

### Cele wydajnosciowe

- Glowny widok produktu gotowy do uzycia: <= 2.5 s
- Pokazanie rekomendacji po podaniu danych: <= 3 s
- Core flow ma sprawiac wrazenie szybkiego i plynnego takze przy wiekszym portfelu oraz przy czesciowym odswiezaniu danych

### Strategia SEO

SEO powinno byc traktowane jako wsparcie akwizycji i edukacji, nie jako glowny sterownik architektury produktu. Priorytet SEO dotyczy landingow, tresci wyjasniajacych metodologie, porownan i stron wejsciowych. Wewnetrzne flow decyzyjne, personalizowane widoki i ekran rekomendacji nie powinny komplikowac produktu tylko po to, by byly indeksowalne.

### Poziom dostepnosci

Docelowy poziom to strong WCAG AA. Obejmuje to czytelne kontrasty, obsluge klawiatura, sensowna strukture naglowkow, jasne komunikaty bledow, zrozumiale stany loading / uncertainty oraz dostepne sposoby prezentacji danych tabelarycznych i porownan inwestycyjnych.

### Uwagi implementacyjne

Implementacja musi chronic doswiadczenie uzytkownika w sytuacjach czesciowych danych, opoznien i niepewnosci. Web app nie moze ukrywac problemow; powinna jawnie komunikowac, kiedy dane sa niepelne, kiedy wynik sie odswieza i kiedy rekomendacja nie moze zostac pokazana z wystarczajaca pewnoscia. To jest rownie wazne jak sama wydajnosc.

## Scoping projektu i fazowanie

### Strategia i filozofia MVP

**MVP Approach:** platform MVP  
**Resource Requirements:** solo founder

Pierwszy release ma zbudowac fundament produktu, ktory daje uzytkownikowi realna wartosc decyzyjna, ale nie probuje od razu dostarczyc calego docelowego cockpitu. Strategia zaklada najpierw udowodnienie, ze Njord potrafi zebrac podstawowy obraz portfela, przeprowadzic uzytkownika przez zaufany flow decyzyjny i pokazac wynik po podatku oraz FX w sposob wystarczajaco wiarygodny, by uzytkownik chcial wrocic.

To oznacza bardzo konserwatywne podejscie do scope'u. MVP musi unikac zaleznosci, ktore groza duzym kosztem integracyjnym lub operacyjnym. Automatyzacja, glebokie integracje i szeroki monitoring nie moga wejsc do pierwszej fazy kosztem jakosci rdzenia decyzyjnego.

### Zakres fazy 1

**Core User Journeys Supported:**
- primary user success path: szybka decyzja dla nowej gotowki / nowej wplaty
- primary user edge case: decyzja przy niepelnych danych i ochronie zaufania
- minimal internal ops/support flow: mozliwosc przesledzenia, skad wziela sie rekomendacja

**Must-Have Capabilities:**
- manual-first lub polmanualne wprowadzenie holdings
- podstawowa agregacja portfela i pozycji
- podstawowy widok portfela jako punkt wyjscia do decyzji
- next-best decision flow dla nowej gotowki / wplaty
- recommendation engine z explanation why
- wynik po podatku i FX
- confidence / uncertainty basics
- audit trail potrzebny do wyjasnienia wyniku i ochrony zaufania

### Zakres po MVP

**Phase 2 (Post-MVP):**
- pelniejszy monitoring dashboard
- alerty i zmiany rekomendacji
- Belka / PIT automation
- scenario history
- goal-based recommendations
- szersze integracje brokerow tam, gdzie to wykonalne

**Phase 3 (Expansion):**
- event-driven investment copilot
- proactive recommendations
- glebsza personalizacja
- bardziej ciagla optymalizacja portfela i momentow decyzyjnych

### Macierz traceability i faz

| Cel / sygnal produktu | Journey | Faza | Kluczowe FR / NFR |
| --- | --- | --- | --- |
| Szybka, zaufana decyzja dla nowej gotowki | 1. Michal - nowa wplata | Faza 1 | FR1-FR19, FR22-FR33 |
| Ochrona zaufania przy niepelnych lub konfliktowych danych | 2. Anna - edge case | Faza 1 | FR5-FR8, FR24-FR25, FR28-FR33, FR42 |
| Operacyjna wiarygodnosc rekomendacji | 3. Kamil - jakosc rekomendacji | Faza 1 | FR39-FR40, NFR Bezpieczenstwo |
| Wyjasnialnosc i audit trail dla supportu | 4. Ewa - troubleshooting | Faza 1 | FR32, FR41-FR42, NFR Bezpieczenstwo |
| Retencja: powrot do monitoringu lub kolejnej decyzji | 5. Michal - recurring monitoring | Faza 2 | FR34-FR37 |
| Ochrona przed naduzyciem, manipulacja i utrata integralnosci | 6. Marta - abuse / fraud ops | Faza 1-2 | FR39-FR40, NFR Bezpieczenstwo, NFR Niezawodnosc |
| Szerszy lokalny kontekst i guidance po MVP | 1 + 5 | Faza 2 | FR20, FR26 |
| Proaktywny investment copilot | 5 | Faza 3 | FR38 |

### Zakotwiczenie roadmap FR

| FR | Faza | Zakotwiczenie w journey | Dlaczego tutaj |
| --- | --- | --- | --- |
| FR20 | Faza 2 | 1 + 5 | Rozszerza MVP-owy wynik po podatku do workflow Belka / PIT przy kolejnych decyzjach i rozliczeniach. |
| FR26 | Faza 2 | 1 + 5 | Rozszerza podstawowe preferencje z MVP do guidance pod cel przy kolejnych decyzjach. |
| FR34-FR37 | Faza 2 | 5 | To rdzen recurring-user journey: monitoring, alerty, historia rekomendacji i historia scenariuszy. |
| FR38 | Faza 3 | 5 | Proaktywny next-best-action ma sens dopiero po zbudowaniu monitoringu, historii i sygnalow powrotu. |

### Strategia ograniczania ryzyka

**Technical Risks:**  
Najwieksze ryzyka techniczne to limity API, brak mozliwosci szybkiego importu danych, bledy finansowe i zlozonosc domeny. Mitigacja dla Phase 1 powinna byc jasna: manual-first data entry jako sciezka pierwszej klasy, ograniczenie liczby zaleznosci zewnetrznych, konserwatywna logika rekomendacji, pelny audit trail i preferowanie braku rekomendacji nad bledna rekomendacja.

**Market Risks:**  
Najwiekszym ryzykiem rynkowym jest to, ze uzytkownik uzna rekomendacje lub analizy za slabe. MVP musi wiec nie tylko pokazac wynik, ale tez udowodnic jego sens przez explainability, lokalny kontekst podatkowo-FX i uczciwa komunikacje niepewnosci. Celem Phase 1 nie jest zachwycic szerokoscia funkcji, tylko zdobyc pierwsze prawdziwe zaufanie.

**Resource Risks:**  
Poniewaz produkt rozwija solo founder, plan musi zakladac minimalizacje operacyjnego ciezaru. Kazda funkcja wymagajaca duzej liczby integracji, recznego utrzymania lub wysokiego support load powinna byc domyslnie przesuwana za Phase 1, chyba ze bezposrednio warunkuje wartosc rdzenia.

## Functional Requirements

### Zrodlo prawdy o portfelu

- **FR1:** Investor can create and maintain a consolidated portfolio view across supported manual and imported holdings sources.
- **FR2:** Investor can add, edit, and remove holdings manually.
- **FR3:** Investor can import portfolio or transaction data from supported external sources when integrations are available.
- **FR4:** Investor can use the product even when holdings data is provided manually rather than through broker integrations.
- **FR5:** Investor can reconcile duplicate, incomplete, conflicting, or incorrectly mapped portfolio data.
- **FR6:** Investor can distinguish confirmed, incomplete, estimated, and unverified portfolio data.
- **FR7:** Investor can review the provenance and freshness of portfolio-relevant data.
- **FR8:** Investor can see how data gaps or conflicts affect portfolio completeness and downstream recommendation quality.

### Ocena decyzji

- **FR9:** Investor can request a recommendation for how to allocate new cash or a new contribution.
- **FR10:** Investor can evaluate what to do with expiring cash products, such as a maturing deposit.
- **FR11:** Investor can compare at least two allocation options, including maintaining the status quo or deferring action.
- **FR12:** Investor can receive a primary recommended next action, a ranked set of alternatives, or a no-action outcome depending on available confidence.
- **FR13:** Investor can understand why the recommended next action is preferred over alternatives.
- **FR14:** Investor can adjust decision assumptions or inputs and see how the outcome changes.
- **FR15:** Investor can revisit the outcome of a prior decision session.

### Lokalny kontekst finansowy

- **FR16:** Investor can see projected outcomes adjusted for applicable taxes.
- **FR17:** Investor can see the impact of FX on compared options.
- **FR18:** Investor can compare global market instruments with relevant Polish alternatives.
- **FR19:** Investor can review tax, FX, and cost assumptions used in a comparison.
- **FR20 [Phase 2]:** Investor can generate a Belka tax summary for a given tax year from recorded transactions and review the PIT-38 line items derived from FIFO-matched lots, applicable NBP rates, and calculated gains/losses.
- **FR21:** Investor can review the baseline, horizon, and net outcome attached to each scenario or alternative.

### Preferencje, dopasowanie i granice

- **FR22:** Investor can define decision preferences such as horizon, liquidity needs, risk tolerance, account preferences, and simplicity-versus-optimization trade-offs.
- **FR23:** Investor can set constraints that exclude unsuitable options from recommendation outputs.
- **FR24:** Investor can see a visible scope disclaimer and a limitations panel describing what the product covers, what it does not cover, and when no recommendation can be treated as reliable.
- **FR25:** Investor can see when a recommendation is outside supported scope or based on unsupported conditions.
- **FR26 [Phase 2]:** Investor can define a savings or allocation goal with amount and time horizon and receive decision guidance aligned to that goal.
- **FR27:** Investor can override a recommendation and preserve that decision context for future sessions.

### Wyjasnialnosc, pewnosc i bramki decyzyjne

- **FR28:** Investor can see the confidence or uncertainty level attached to a recommendation.
- **FR29:** Investor can see the main factors that could change or reverse a recommendation.
- **FR30:** Investor can see when incomplete, stale, or conflicting data limits recommendation strength.
- **FR31:** Investor can receive a no-recommendation or conditional-recommendation outcome when available information is insufficient for a defensible answer based on available data and declared assumptions.
- **FR32:** Investor can review the rationale, source data context, assumptions, and blockers behind a recommendation.
- **FR33:** Investor can distinguish between strong, conditional, and informational guidance.

### Monitoring, historia i dalsze kroki

- **FR34 [Phase 2]:** Investor can monitor defined changes in portfolio, FX, tax assumptions, or recommendation quality that may invalidate a prior decision.
- **FR35 [Phase 2]:** Investor can receive alerts when a tracked threshold, assumption, or recommendation-confidence change is crossed.
- **FR36 [Phase 2]:** Investor can review the history of recommendations, recorded decisions, and the specific changes that caused a different outcome.
- **FR37 [Phase 2]:** Investor can review historical scenarios, prior decision baselines, and the assumptions attached to each decision moment.
- **FR38 [Phase 3]:** Investor can receive proactive next-best-action guidance when at least one of the following triggers fires: FX rate delta exceeds a user-defined threshold, a monitored instrument drops below or above a set price level, a bond maturity date falls within 30 days, or portfolio allocation drifts beyond a declared tolerance band.

### Wsparcie i bezpieczniki rekomendacji

- **FR39:** Operations users can review signals related to data quality, recommendation quality, and confidence.
- **FR40:** Operations users can limit, flag, or suppress recommendations when reliability is in doubt.
- **FR41:** Support users can trace a recommendation back to its source data, assumptions, freshness, and detected issues.
- **FR42:** Support users can help investors correct incomplete or conflicting portfolio data.

## Non-Functional Requirements

Kazdy NFR ponizej ma charakter pass/fail na poziomie wydania. Niespelnienie progu blokuje release flow decyzyjnego.

### Tabela pomiaru NFR

| Obszar | Metryka | Cel | Metoda / dowod | Wlasciciel |
|---|---|---|---|---|
| Wydajnosc | Gotowosc glownego widoku; czas do rekomendacji | <= 2,5 s p95; <= 3 s p95 | pomiar produkcyjny + test syntetyczny przed release | Engineering |
| Bezpieczenstwo | Ekspozycja danych; audit zmian; prawa uzytkownika do danych | 0 nieautoryzowanych ekspozycji; 100% zmian audytowalnych; obsluga zadan danych <= 30 dni | testy dostepu, przeglad sladu audytowego, rejestr compliance | Engineering + Product |
| Skalowalnosc | Utrzymanie jakosci przy skali startowej | spelnienie NFR wydajnosci i 0 krytycznych bledow przy >= 60 aktywnych uzytkownikach | test obciazeniowy przed release | Engineering |
| Dostepnosc | Dostepnosc kluczowych flow | WCAG 2.2 AA; 0 blockerow klawiaturowych | audit automatyczny i manualny | Design + QA |
| Integracje | Kompletnosc i jawnosc danych zewnetrznych | 100% wynikow z oznaczonym zrodlem, swiezoscia i statusem kompletnosci | testy akceptacyjne + checklist release | Product + Engineering |
| Niezawodnosc | Dostepnosc flow; zachowanie przy awarii | >= 99,5% miesiecznie; 100% awarii krytycznych konczy sie stanem jawnym albo brakiem rekomendacji | monitoring, testy awarii, przeglad incydentow | Engineering |

### Wydajnosc

- Glowny widok produktu musi byc gotowy do uzycia w czasie <= 2,5 s dla p95 sesji w typowym scenariuszu MVP; dowod: pomiar produkcyjny i test syntetyczny przed release.
- Rekomendacja po podaniu kompletnych danych wejsciowych musi byc prezentowana w czasie <= 3 s dla p95 prob; dowod: test E2E na danych referencyjnych i pomiar release candidate.
- Jezeli obliczenie lub odswiezenie danych trwa dluzej niz prog, uzytkownik w czasie <= 1 s od startu akcji musi zobaczyc jawny stan oczekiwania, odswiezania albo niepewnosci; brak takiego stanu = fail.
- Jezeli po 10 s wynik nadal nie moze zostac obroniony z powodu opoznienia lub brakow danych, produkt nie pokazuje domyslnej rekomendacji; pokazuje opoznienie wyniku albo brak rekomendacji.

### Bezpieczenstwo

- Dane portfelowe, transakcyjne, podatkowe i slad rekomendacji nie moga zostac ujawnione osobie nieuprawnionej; prog pass/fail = 0 nieautoryzowanych ekspozycji w testach dostepu i regresji bezpieczenstwa.
- Kazda zmiana danych wejsciowych wplywajacych na rekomendacje albo rozliczenie musi byc odtwarzalna: kto lub co zmienilo dane, kiedy, jaki byl zakres zmiany i jaki wynik powstal po zmianie; dowod: przeglad sladu audytowego na scenariuszach referencyjnych.
- Produkt musi umozliwiac obsluge zadania eksportu lub usuniecia danych uzytkownika w czasie <= 30 dni kalendarzowych; dowod: procedura operacyjna i test zgodnosci.
- Produkt nie moze cicho zmieniac, gubic ani nadpisywac danych uzytkownika; odsetek niewyjasnionych rozbieznosci danych w scenariuszach krytycznych = 0.

### Skalowalnosc

- Produkt musi utrzymac wszystkie progi wydajnosci oraz 0 krytycznych bledow w rekomendacji i warstwie podatkowej przy skali co najmniej 60 aktywnych uzytkownikow i obciazeniu odpowiadajacym tej skali; dowod: test obciazeniowy przed release.
- Wzrost ruchu nie moze obnizac poprawnosci wyniku; odsetek niespojnych, niekompletnych albo blednie policzonych rekomendacji w tescie obciazeniowym = 0.
- Jezeli obciazenie przekracza bezpieczny zakres, produkt moze opoznic nowe obliczenia lub ograniczyc ich uruchamianie, ale nie moze obnizyc jakosci wyniku ani pokazac mylacej rekomendacji; 100% takich sytuacji musi konczyc sie jawnym komunikatem.

### Dostepnosc

- Wszystkie kluczowe flow produktu - wprowadzenie danych, porownanie opcji, odczyt uzasadnienia, komunikaty bledow, stany niepewnosci i brak rekomendacji - musza spelniac poziom WCAG 2.2 AA; dowod: audit automatyczny i manualny przed release.
- Core flow musi byc w pelni obslugiwalny z klawiatury; prog pass/fail = 0 blockerow klawiaturowych w scenariuszach referencyjnych.
- Dane tabelaryczne, uzasadnienia rekomendacji, ostrzezenia i stany degradacji musza byc dostepne dla technologii wspierajacych; komunikacja nie moze opierac sie wylacznie na kolorze, ikonie albo animacji. Prog pass/fail: (a) kazda tabela posiada opis lub naglowki zrozumiale bez kontekstu wizualnego, (b) kazde ostrzezenie posiada tekst alternatywny poza ikona, (c) stan degradacji ma jawny komunikat tekstowy poza zmiana koloru; dowod: scenariusze referencyjne w trybie screen reader i high-contrast.
- Dostepnosc obejmuje rdzen doswiadczenia produktowego, nie tylko warstwe informacyjna lub marketingowa.

### Integracje

- Produkt musi pozwolic uzytkownikowi przejsc pelny core flow w modelu manual-first, nawet bez integracji z brokerem; prog pass/fail = mozliwosc dojscia do wyniku albo jawnego braku rekomendacji w scenariuszu referencyjnym bez automatycznej integracji.
- Kazde zewnetrzne zrodlo uzyte do wyniku musi pokazywac zrodlo, czas ostatniego odswiezenia i status kompletnosci zanim uzytkownik oprze na nim decyzje; dowod: testy akceptacyjne i checklist release.
- Blad, limit albo brak odpowiedzi po stronie zrodla zewnetrznego nie moze prowadzic do cichego wygenerowania mylacej rekomendacji; prog pass/fail = 0 takich przypadkow w testach scenariuszy brzegowych.
- Jezeli brakuje krytycznego wejscia, takiego jak kurs FX, cena instrumentu, dane podatkowe albo komplet pozycji, produkt nie pokazuje jednoznacznej rekomendacji; pokazuje brak rekomendacji albo wynik warunkowy z opisem brakow i nastepnym krokiem.

### Niezawodnosc

- Dostepnosc miesieczna glownego flow decyzyjnego musi wynosic >= 99,5%, liczona jako mozliwosc otwarcia widoku, wprowadzenia danych oraz uzyskania wyniku albo jawnego braku rekomendacji; dowod: monitoring produkcyjny.
- Kazda czesciowa awaria danych rynkowych, kursow, importu albo silnika rekomendacji musi w czasie <= 5 s zakonczyc sie jawnym stanem: co dziala, co nie dziala, jaki jest wplyw na wynik i co uzytkownik moze zrobic dalej.
- Produkt musi preferowac brak rekomendacji nad wynik, ktorego nie mozna obronic; odsetek blednie pokazanych jednoznacznych rekomendacji przy niespojnych, nieaktualnych albo niekompletnych danych = 0 w zestawie scenariuszy krytycznych.
- W trybie degradacji uzytkownik musi zachowac orientacje w stanie produktu: widzi status, zakres wplywu, ostatni wiarygodny moment danych oraz czy moze kontynuowac manualnie, czy powinien wstrzymac decyzje. Prog pass/fail: w kazdym scenariuszu degradacji uzytkownik widzi (a) nazwe uslugi lub komponentu z problemem, (b) timestamp ostatnich wiarygodnych danych, (c) opis wplywu na wynik, (d) jasna rekomendacje dzialania (kontynuuj/wstrzymaj); brak dowolnego z tych elementow = fail; dowod: testy scenariuszy degradacji z symulowanymi awariami.
