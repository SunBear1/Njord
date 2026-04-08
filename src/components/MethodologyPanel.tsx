import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

export function MethodologyPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-gray-800 font-medium hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <BookOpen size={18} aria-hidden="true" />
          Jak obliczamy wyniki? (metodologia)
        </span>
        {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>

      {open && (
        <div className="px-5 py-4 border-t border-gray-200 text-sm text-gray-800 space-y-5">

          {/* 1. Wartość bieżąca */}
          <section className="space-y-1">
            <h3 className="font-semibold text-gray-900">1. Wartość bieżąca portfela</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-3 font-mono text-xs">
              Wartość<sub>PLN</sub> = Liczba akcji × Cena akcji<sub>USD</sub> × Kurs USD/PLN
            </div>
            <p className="text-xs text-gray-600">
              To jest punkt startowy obu scenariuszy — kwota, którą masz dziś w akcjach,
              wyrażona w PLN po przeliczeniu po bieżącym kursie.
            </p>
          </section>

          {/* 2. Konto oszczędnościowe */}
          <section className="space-y-1">
            <h3 className="font-semibold text-gray-900">2a. Konto oszczędnościowe</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-3 font-mono text-xs space-y-1">
              <div>Stopa miesięczna = Oprocentowanie roczne ÷ 12</div>
              <div>Wartość brutto = Kapitał × (1 + stopa miesięczna)<sup>n miesięcy</sup></div>
              <div>Odsetki brutto = Wartość brutto − Kapitał</div>
              <div>Odsetki netto = Odsetki brutto × (1 − 0,19)</div>
              <div className="font-semibold">Wartość końcowa = Kapitał + Odsetki netto</div>
            </div>
            <p className="text-xs text-gray-600">
              Zakładamy kapitalizację miesięczną. Podatek Belki (19%) jest naliczany od
              wypracowanych odsetek.
            </p>
          </section>

          {/* 2b. Obligacje skarbowe */}
          <section className="space-y-1">
            <h3 className="font-semibold text-gray-900">2b. Obligacje skarbowe</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-3 font-mono text-xs space-y-1">
              <div className="font-semibold">Obliczanie rok po roku:</div>
              <div className="pl-4">Rok 1: Wartość × (1 + stopa 1. roku)</div>
              <div className="pl-4">Rok 2+: Wartość × (1 + stopa efektywna) za każdy pełny rok</div>
              <div className="pl-4">Niepełny rok: Wartość × (1 + stopa × miesiące ÷ 12)</div>
              <div className="pt-1">Stopa efektywna zależy od typu obligacji:</div>
              <div className="pl-4">Stałoprocentowe (OTS, TOS): stopa = stała przez cały okres</div>
              <div className="pl-4">Zmiennoprocentowe (ROR, DOR): stopa = stopa ref. NBP + marża</div>
              <div className="pl-4">Indeksowane inflacją (COI, EDO, ROS, ROD): stopa = inflacja + marża</div>
              <div className="pt-1">Kara za wcześniejszy wykup odejmana PRZED naliczeniem podatku:</div>
              <div className="pl-4">Kwota efektywna = Wartość brutto − Kara</div>
              <div className="pl-4">Jeśli zysk (kwota ef. &gt; kapitał): podatek = (kwota ef. − kapitał) × 19%</div>
              <div className="pl-4">Jeśli strata (kwota ef. ≤ kapitał): brak podatku</div>
              <div className="font-semibold">Wartość końcowa = Kwota efektywna − podatek (jeśli dotyczy)</div>
            </div>
            <p className="text-xs text-gray-600">
              Obligacje stosują kapitalizację roczną. Kara za wcześniejszy wykup obowiązuje
              gdy horyzont &lt; zapadalność. Obligacje indeksowane inflacją (COI, EDO, ROS, ROD)
              mają stałą stopę w 1. roku, potem inflacja CPI + marża. Inflacja pobierana automatycznie
              z GUS BDL (oficjalny polski CPI). Obligacje ROS i ROD to obligacje rodzinne (program 800+).
              Stawki odpowiadają aktualnej ofercie z obligacjeskarbowe.pl — mogą się zmieniać co miesiąc.
            </p>
          </section>

          {/* 3. Trzymanie akcji */}
          <section className="space-y-1">
            <h3 className="font-semibold text-gray-900">3. Trzymanie akcji (scenariusz)</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-3 font-mono text-xs space-y-1">
              <div>Cena przyszła = Cena dziś × (1 + Δ ceny akcji%)</div>
              <div>Kurs przyszły = Kurs dziś × (1 + Δ kursu USD/PLN%)</div>
              <div>Wartość brutto = Liczba akcji × Cena przyszła × Kurs przyszły</div>
              <div>Jeśli wartość brutto &gt; kapitał (zysk):</div>
              <div className="pl-4">Zysk netto = (Wartość brutto − Kapitał) × (1 − 0,19)</div>
              <div className="pl-4 font-semibold">Wartość końcowa = Kapitał + Zysk netto</div>
              <div>Jeśli wartość brutto ≤ kapitał (strata):</div>
              <div className="pl-4 font-semibold">Wartość końcowa = Wartość brutto</div>
            </div>
            <p className="text-xs text-gray-600">
              Podatek Belki (19%) jest pobierany tylko od zysku. W przypadku straty — brak podatku,
              więc końcowa wartość to pełna kwota (bez potrąceń).
            </p>
          </section>

          {/* 4. Sugestie z historii */}
          <section className="space-y-1">
            <h3 className="font-semibold text-gray-900">4. Sugestie z danych historycznych</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-3 font-mono text-xs space-y-1">
              <div>σ dzienne = odchylenie standardowe dziennych stóp zwrotu (~1 rok danych)</div>
              <div>σ roczne = σ dzienne × √252 &nbsp;|&nbsp; T = horyzont w latach</div>
              <div>ρ = korelacja Pearsona (stopy zwrotu akcji vs. USD/PLN)</div>
              <div className="pt-1 font-semibold">Bear/Bull — percentyle 5%/95% rozkładu log-normalnego (zerowy dryf):</div>
              <div className="pl-4">Bear (p5):  exp(−1,645·σ·√T − σ²/2·T) − 1</div>
              <div className="pl-4">Bull (p95): exp(+1,645·σ·√T − σ²/2·T) − 1</div>
              <div className="pl-4">Δ FX Bear = −ρ × |FX p95|, &nbsp;Δ FX Bull = +ρ × |FX p95|</div>
              <div className="pt-1">Base: Δ akcji = 0%, Δ FX = 0% (neutralny punkt startowy)</div>
            </div>
            <p className="text-xs text-gray-600">
              Rozkład log-normalny unika błędów arytmetycznego skalowania (np. "−150%") przy długich horyzontach.
              Zerowy dryf w Bear/Bull sprawia, że scenariusze nie zakładają powtórzenia ostatniego trendu —
              historyczna średnia przy ~1 roku danych ma błąd standardowy ±30–50 pp rocznie.
              Trend akcji wyświetlany jest jako informacja. Korelacja ρ: przy ujemnej ρ spadek akcji
              idzie w parze z umocnieniem dolara, co amortyzuje stratę (Δ FX Bear {'>'} 0).
            </p>
          </section>

          {/* 5. Oś czasu */}
          <section className="space-y-1">
            <h3 className="font-semibold text-gray-900">5. Wykres wartości w czasie</h3>
            <p className="text-xs text-gray-600">
              Scenariuszowe zmiany cen (Δ akcji, Δ FX) są skalowane liniowo do każdego miesiąca.
              Np. jeśli w scenariuszu Bull Δ akcji = +15% na 6 miesięcy, to po 3 miesiącach
              przyjmujemy +7,5%. Jest to przybliżenie — rzeczywiste zwroty kumulują się
              geometrycznie, ale różnica jest minimalna dla krótkich i średnich horyzontów.
            </p>
          </section>

          {/* 6. Heatmapa */}
          <section className="space-y-1">
            <h3 className="font-semibold text-gray-900">6. Mapa break-even</h3>
            <p className="text-xs text-gray-600">
              Siatka 11×11 kombinacji (Δ ceny akcji × Δ kursu USD/PLN) od −20% do +20%.
              Dla każdej kombinacji obliczamy wartość końcową akcji (po podatku) i porównujemy
              z wartością benchmarku (konto lub obligacje). Zielone komórki = akcje biją benchmark.
            </p>
          </section>

          {/* Założenia */}
          {/* 7. Korekta o inflację */}
          <section className="space-y-1">
            <h3 className="font-semibold text-gray-900">7. Korekta o inflację (zwrot realny)</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-3 font-mono text-xs">
              Inflacja<sub>skumulowana</sub> = (1 + r<sub>CPI</sub>)<sup>T</sup> − 1<br />
              Zwrot<sub>realny</sub> = (1 + Zwrot<sub>nominalny</sub>) / (1 + Inflacja<sub>skumulowana</sub>) − 1
            </div>
            <p className="text-xs text-gray-600">
              Stosujemy dokładny wzór Fishera. Stopa inflacji pochodzi z danych GUS (CPI rok do roku).
              Zwrot realny pokazuje, ile faktycznie zyskujesz po uwzględnieniu spadku siły nabywczej pieniądza.
            </p>
          </section>

          <section className="bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1">
            <h3 className="font-semibold text-amber-900">Założenia i ograniczenia</h3>
            <ul className="list-disc list-inside text-xs text-amber-800 space-y-1">
              <li>
                <strong>Podatek Belki (19%)</strong> od zysku zarówno z akcji, jak i z odsetek
              </li>
              <li>
                <strong>Baza podatkowa = wartość bieżąca.</strong> Porównujemy marginalny zysk
                od teraz. Podatek od dotychczasowego zysku jest taki sam niezależnie od decyzji,
                więc go pomijamy — nie wpływa na wybór „trzymać vs. sprzedać".
              </li>
              <li>
                <strong>Brak prowizji maklerskich</strong> — przy sprzedaży/kupnie akcji
              </li>
              <li>
                <strong>Brak spreadu walutowego</strong> — koszt wymiany USD → PLN
              </li>
              <li>
                <strong>Brak dywidend</strong> — nie uwzględniamy wypłat z akcji
              </li>
              <li>
                <strong>Inflacja stała</strong> — zakładamy stałą roczną stopę CPI z ostatniego odczytu GUS;
                rzeczywista inflacja może się zmieniać
              </li>
              <li>
                <strong>Dane historyczne (~1 rok)</strong> — zmienność i korelacja mogą się
                zmieniać; przeszłość nie gwarantuje przyszłości
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
