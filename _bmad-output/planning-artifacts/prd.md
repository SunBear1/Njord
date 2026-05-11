---
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
inputDocuments:
  - docs/backtest-methodology.md
  - docs/financial-methodology.md
workflowType: 'prd'
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

W krotkim horyzoncie sukces oznacza, ze Njord przestaje byc narzedziem jednorazowym i zaczyna pelnic role miejsca, do ktorego uzytkownik wraca regularnie. Docelowy sygnal na tym etapie to 30% miesiecznego powrotu aktywowanych uzytkownikow do monitoringu lub kolejnej decyzji inwestycyjnej.

W srednim horyzoncie produkt wygrywa wtedy, gdy uzytkownik po pierwszym trafnym lub uzytecznym doswiadczeniu wraca do Njorda przy kolejnych decyzjach, zamiast ponownie rozpraszac sie miedzy wieloma zrodlami. Dodatkowym sygnalem biznesowym jest to, ze 60% aktywowanych uzytkownikow ufa rekomendacji na tyle, aby dzialac zgodnie z nia.

Monetyzacja jest wtorna wobec zaufania. Produkt nie powinien probowac sprzedawac sie obietnica potencjalnego zysku, lecz udowodniona oszczednoscia czasu, wiekszym spokojem decyzyjnym oraz dodatkowymi funkcjami premium, gdy rdzen okaze sie wiarygodny.

### Sukces techniczny

Rdzen produktu musi dzialac w standardzie zero critical errors dla rekomendacji inwestycyjnych i warstwy podatkowej. Jesli uzytkownik otrzyma oczywiscie zla, ryzykowna albo niespojna rekomendacje, utrata zaufania bedzie praktycznie nieodwracalna.

Techniczny sukces oznacza wiec: poprawne i audytowalne obliczenia, wiarygodne pokazanie wyniku po podatku i FX, czytelna agregacje pozycji, jasne uzasadnienie rekomendacji oraz przeplyw decyzyjny, ktory realnie miesci sie w mniej niz 5 minutach. Produkt powinien tez jasno komunikowac zalozenia, zrodla danych i granice pewnosci rekomendacji.

### Wymierne rezultaty

- Czas od wejscia do uzyskania rekomendacji: < 5 min
- Miesieczny powrot aktywowanych uzytkownikow: 30%
- Odsetek aktywowanych uzytkownikow dzialajacych zgodnie z rekomendacja: 60%
- Krytyczne bledy w rdzeniu rekomendacji / podatkow: 0
- Kazda rekomendacja zawiera uzasadnienie oraz wplyw podatku i FX

## Product Scope

### Faza 1 - Platform MVP

MVP musi udowodnic, ze Njord potrafi doprowadzic uzytkownika do zaufanej decyzji. Dlatego zakres MVP powinien obejmowac agregacje portfela i pozycji, reczne lub importowane wprowadzenie holdings, rekomendacje decyzji alokacyjnej, wyjasnienie dlaczego taka rekomendacja zostala pokazana oraz wynik uwzgledniajacy podatek i FX.

### Faza 2 - Funkcje po MVP

Po MVP produkt powinien zyskac warstwe, ktora wzmacnia retencje i przewage konkurencyjna: monitoring dashboard, alerty i zmiany rekomendacji, automatyzacje Belki i PIT, historie scenariuszy, rekomendacje pod cele uzytkownika oraz szersze integracje z wieloma brokerami.

### Faza 3 - Wizja docelowa

Docelowa wersja produktu to osobisty investment copilot dla polskiego inwestora, ktory nie tylko odpowiada na pytania zadane recznie, ale tez proaktywnie podpowiada, kiedy decyzja powinna sie zmienic i co warto zrobic dalej.

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

### Podsumowanie wymaganych zdolnosci

Te journeys ujawniaja potrzebe kilku kluczowych capability areas:
- agregacja portfela i pozycji z wielu zrodel,
- import i reczna korekta danych,
- decision engine z uzasadnieniem rekomendacji,
- wynik po podatku i FX,
- sygnalizowanie poziomu pewnosci i brakow danych,
- obsluga edge case'ow bez utraty zaufania,
- operacyjny monitoring jakosci rekomendacji,
- traceability dla supportu i audytu decyzji.

## Domain-Specific Requirements

### Zgodnosc i regulacje

- Produkt musi pozostac po stronie decision support, a nie formalnej porady inwestycyjnej. Njord nie moze komunikowac sie w trybie "zrob to", lecz powinien pokazywac porownywalne wyniki, scenariusze, zysk netto, wplyw podatku, FX i zalozenia, pozostawiajac ostateczny wybor uzytkownikowi.
- Warstwa rekomendacyjna musi byc wsparta wyraznym framingiem produktu, transparentnoscia metodologii oraz guardrailami jezykowymi ograniczajacymi ryzyko interpretacji jako bezposredniej porady finansowej.
- Ze wzgledu na ryzyko roszczen zwiazanych ze strata finansowa, produkt musi posiadac jasne zastrzezenia odpowiedzialnosci, slad decyzyjny oraz mozliwosc odtworzenia, na jakich danych i zalozeniach powstal wynik.

### Ograniczenia techniczne

- Produkt bedzie przechowywal wrazliwe dane portfelowe i transakcyjne, wiec musi spelniac wysoki standard bezpieczenstwa danych: kontrola dostepu, bezpieczne przechowywanie, minimalizacja zakresu danych i wysoka czytelnosc granic prywatnosci.
- Kazda rekomendacja musi miec pelny audit trail: dane wejsciowe, zrodla cen i kursow, zalozenia, wplyw podatku, poziom pewnosci i powod wygenerowania wyniku.
- Nie ma pola na krytyczne bledy w rekomendacji ani podatkach; system musi preferowac brak rekomendacji lub obnizenie pewnosci zamiast pokazania wyniku, ktorego nie da sie obronic.
- Produkt musi jasno odrozniac dane potwierdzone od niepelnych albo recznie wprowadzonych oraz komunikowac, jak to wplywa na pewnosc wyniku.

### Wymagania integracyjne

- Integracje z brokerami moga byc ograniczone lub niemozliwe z powodu braku API, wiec produkt musi dzialac rowniez w modelu manual-first albo manual-plus-import, bez uzaleznienia wartosci MVP od pelnej automatyzacji.
- Konieczne sa wiarygodne integracje z danymi rynkowymi i referencyjnymi: kursy walut, ceny akcji, ETF-ow, krypto i obligacji.
- Import danych uzytkownika powinien wspierac stopniowe budowanie obrazu portfela: od recznego wprowadzania, przez polautomatyczny import, po szersze integracje tam, gdzie sa mozliwe.

### Ograniczanie ryzyka

- **Zla rekomendacja:** guardraile, explainability, confidence signaling, mozliwosc wstrzymania rekomendacji przy slabych danych.
- **Bledny podatek:** pelna sciezka audytu, testowalna logika podatkowa, jawne zalozenia i mozliwosc weryfikacji przez uzytkownika.
- **Brak API brokerow / bankow:** manual entry jako sciezka pierwszej klasy, a nie awaryjny dodatek.
- **Odpowiedzialnosc za strate finansowa:** komunikacja decision-support, nie direct advice; transparentnosc metodologii i ograniczen systemu.

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

### Strategia ograniczania ryzyka

**Technical Risks:**  
Najwieksze ryzyka techniczne to limity API, brak mozliwosci szybkiego importu danych, bledy finansowe i zlozonosc domeny. Mitigacja dla Phase 1 powinna byc jasna: manual-first data entry jako sciezka pierwszej klasy, ograniczenie liczby zaleznosci zewnetrznych, konserwatywna logika rekomendacji, pelny audit trail i preferowanie braku rekomendacji nad bledna rekomendacja.

**Market Risks:**  
Najwiekszym ryzykiem rynkowym jest to, ze uzytkownik uzna rekomendacje lub analizy za slabe. MVP musi wiec nie tylko pokazac wynik, ale tez udowodnic jego sens przez explainability, lokalny kontekst podatkowo-FX i uczciwa komunikacje niepewnosci. Celem Phase 1 nie jest zachwycic szerokoscia funkcji, tylko zdobyc pierwsze prawdziwe zaufanie.

**Resource Risks:**  
Poniewaz produkt rozwija solo founder, plan musi zakladac minimalizacje operacyjnego ciezaru. Kazda funkcja wymagajaca duzej liczby integracji, recznego utrzymania lub wysokiego support load powinna byc domyslnie przesuwana za Phase 1, chyba ze bezposrednio warunkuje wartosc rdzenia.

## Functional Requirements

### Zrodlo prawdy o portfelu

- **FR1:** Investor can create and maintain a consolidated portfolio view across multiple holdings sources.
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
- **FR11:** Investor can compare multiple allocation options, including maintaining the status quo or deferring action.
- **FR12:** Investor can receive a primary recommended next action, a ranked set of alternatives, or a no-action outcome depending on available confidence.
- **FR13:** Investor can understand why the recommended next action is preferred over alternatives.
- **FR14:** Investor can adjust decision assumptions or inputs and see how the outcome changes.
- **FR15:** Investor can revisit the outcome of a prior decision session.

### Lokalny kontekst finansowy

- **FR16:** Investor can see projected outcomes adjusted for applicable taxes.
- **FR17:** Investor can see the impact of FX on compared options.
- **FR18:** Investor can compare global market instruments with relevant Polish alternatives.
- **FR19:** Investor can review tax, FX, and cost assumptions used in a comparison.
- **FR20:** Investor can use product support for Belka and PIT-related workflows in later phases.
- **FR21:** Investor can review the baseline, horizon, and net outcome attached to each scenario or alternative.

### Preferencje, dopasowanie i granice

- **FR22:** Investor can define decision preferences such as horizon, liquidity needs, risk tolerance, account preferences, and simplicity-versus-optimization trade-offs.
- **FR23:** Investor can set constraints that exclude unsuitable options from recommendation outputs.
- **FR24:** Investor can understand the boundaries of what the product is and is not claiming.
- **FR25:** Investor can see when a recommendation is outside supported scope or based on unsupported conditions.
- **FR26:** Investor can use goal-based decision guidance in post-MVP phases.
- **FR27:** Investor can override a recommendation and preserve that decision context for future sessions.

### Wyjasnialnosc, pewnosc i bramki decyzyjne

- **FR28:** Investor can see the confidence or uncertainty level attached to a recommendation.
- **FR29:** Investor can see the main factors that could change or reverse a recommendation.
- **FR30:** Investor can see when incomplete, stale, or conflicting data limits recommendation strength.
- **FR31:** Investor can receive a no-recommendation or conditional-recommendation outcome when available information is insufficient for a trustworthy answer.
- **FR32:** Investor can review the rationale, source data context, assumptions, and blockers behind a recommendation.
- **FR33:** Investor can distinguish between strong, conditional, and informational guidance.

### Monitoring, historia i dalsze kroki

- **FR34:** Investor can monitor changes that may affect prior decisions.
- **FR35:** Investor can receive alerts when relevant conditions, recommendation quality, or portfolio context change.
- **FR36:** Investor can review the history of recommendations, decisions, and what changed between decision moments.
- **FR37:** Investor can review historical scenarios and prior decision baselines.
- **FR38:** Investor can receive proactive next-best-action guidance in future phases.

### Wsparcie i bezpieczniki rekomendacji

- **FR39:** Operations users can review signals related to data quality, recommendation quality, and confidence.
- **FR40:** Operations users can limit, flag, or suppress recommendations when reliability is in doubt.
- **FR41:** Support users can trace a recommendation back to its source data, assumptions, freshness, and detected issues.
- **FR42:** Support users can help investors correct incomplete or conflicting portfolio data.

## Non-Functional Requirements

### Wydajnosc

- Glowny widok produktu musi byc gotowy do uzycia w czasie <= 2.5 s w typowym scenariuszu uzytkownika.
- Rekomendacja po podaniu danych wejsciowych musi byc prezentowana w czasie <= 3 s w typowym flow decyzyjnym.
- Spadek wydajnosci nie moze prowadzic do ukrycia stanu systemu; jesli odpowiedz trwa dluzej, uzytkownik musi widziec czytelny stan oczekiwania, odswiezania lub niepewnosci.

### Bezpieczenstwo

- Integralnosc danych jest priorytetem krytycznym: system nie moze cicho zmieniac, gubic ani nadpisywac danych portfelowych, transakcyjnych ani podatkowych.
- Wrazliwe dane portfelowe i transakcyjne musza byc chronione zarowno w transmisji, jak i w przechowywaniu.
- Dostep do danych uzytkownika i sladow rekomendacji musi byc ograniczony zgodnie z rola oraz zakresem niezbednym do dzialania produktu lub wsparcia.
- System musi zachowywac audit trail zmian danych i rekomendacji tam, gdzie wplywa to na zaufanie, rozliczenia lub wyjasnienie wyniku.
- GDPR i prywatnosc danych traktujemy jako twardy wymog projektowy.

### Skalowalnosc

- Produkt musi stabilnie obslugiwac obecna skale startowa oraz wzrost co najmniej do 60 aktywnych uzytkownikow bez utraty podstawowych parametrow core flow.
- Wzrost liczby uzytkownikow nie moze obnizac poprawnosci rekomendacji, integralnosci danych ani czytelnosci stanu integracji.
- Architektura powinna umozliwiac stopniowy wzrost bez wymuszania natychmiastowej przebudowy calego produktu.

### Dostepnosc

- Produkt musi spelniac poziom strong WCAG AA jako wymog zaufania i uzytecznosci.
- Kluczowe flow decyzyjne, porownania, komunikaty bledow, stany niepewnosci i dane tabelaryczne musza pozostac dostepne dla uzytkownikow korzystajacych z klawiatury i technologii wspierajacych.
- Dostepnosc nie moze byc ograniczona tylko do warstwy marketingowej; obejmuje rowniez rdzen doswiadczenia produktowego.

### Integracje

- Produkt musi dzialac poprawnie takze wtedy, gdy pelne integracje brokerow nie sa dostepne; manual-first nie moze byc sciezka gorszej kategorii.
- Integracje rynkowe i referencyjne musza jasno komunikowac swiezosc danych, niepowodzenia pobrania oraz zakres brakujacych informacji.
- Blad lub limit po stronie zewnetrznego zrodla nie moze prowadzic do cichego wygenerowania mylacej rekomendacji.

### Niezawodnosc

- Jesli dane rynkowe, kursy, import lub silnik rekomendacji sa chwilowo niedostepne, uzytkownik musi dostac jasna informacje o problemie oraz status, ze trwaja dzialania naprawcze.
- System powinien preferowac brak rekomendacji, wynik warunkowy albo opoznienie wyniku nad pokazanie odpowiedzi, ktorej nie mozna obronic.
- Produkt musi zachowywac spojnosc doswiadczenia nawet przy czesciowych awariach: uzytkownik ma wiedziec, co dziala, co nie dziala i jak wplywa to na zaufanie do wyniku.
