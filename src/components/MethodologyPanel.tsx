import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

export function MethodologyPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-slate-800 font-medium hover:bg-slate-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <BookOpen size={18} />
          Jak obliczamy wyniki? (metodologia)
        </span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div className="px-5 py-4 border-t border-slate-200 text-sm text-slate-800 space-y-5">

          {/* 1. Wartość bieżąca */}
          <section className="space-y-1">
            <h3 className="font-semibold text-slate-900">1. Wartość bieżąca portfela</h3>
            <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-xs">
              Wartość<sub>PLN</sub> = Liczba akcji × Cena akcji<sub>USD</sub> × Kurs USD/PLN
            </div>
            <p className="text-xs text-slate-600">
              To jest punkt startowy obu scenariuszy — kwota, którą masz dziś w akcjach,
              wyrażona w PLN po przeliczeniu po bieżącym kursie.
            </p>
          </section>

          {/* 2. Konto oszczędnościowe */}
          <section className="space-y-1">
            <h3 className="font-semibold text-slate-900">2a. Konto oszczędnościowe</h3>
            <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-xs space-y-1">
              <div>Stopa miesięczna = Oprocentowanie roczne ÷ 12</div>
              <div>Wartość brutto = Kapitał × (1 + stopa miesięczna)<sup>n miesięcy</sup></div>
              <div>Odsetki brutto = Wartość brutto − Kapitał</div>
              <div>Odsetki netto = Odsetki brutto × (1 − 0,19)</div>
              <div className="font-semibold">Wartość końcowa = Kapitał + Odsetki netto</div>
            </div>
            <p className="text-xs text-slate-600">
              Zakładamy kapitalizację miesięczną. Podatek Belki (19%) jest naliczany od
              wypracowanych odsetek.
            </p>
          </section>

          {/* 2b. Obligacje skarbowe */}
          <section className="space-y-1">
            <h3 className="font-semibold text-slate-900">2b. Obligacje skarbowe</h3>
            <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-xs space-y-1">
              <div className="font-semibold">Obliczanie rok po roku:</div>
              <div className="pl-4">Rok 1: Wartość × (1 + stopa 1. roku)</div>
              <div className="pl-4">Rok 2+: Wartość × (1 + stopa efektywna) za każdy pełny rok</div>
              <div className="pl-4">Niepełny rok: Wartość × (1 + stopa × miesiące ÷ 12)</div>
              <div className="pt-1">Stopa efektywna zależy od typu obligacji:</div>
              <div className="pl-4">Stałoprocentowe (OTS, TOS): stopa = stała przez cały okres</div>
              <div className="pl-4">Zmiennoprocentowe (ROR, DOR): stopa = stopa ref. NBP + marża</div>
              <div className="pl-4">Indeksowane inflacją (COI, EDO, ROS, ROD): stopa = inflacja + marża</div>
              <div className="pt-1">Odsetki netto = (Wartość końcowa − Kapitał) × (1 − 0,19)</div>
              <div>Kara za wcześniejszy wykup (jeśli dotyczy) = Kapitał × kara%</div>
              <div className="font-semibold">Wartość końcowa = Kapitał + Odsetki netto − Kara</div>
            </div>
            <p className="text-xs text-slate-600">
              Obligacje stosują kapitalizację roczną. Kara za wcześniejszy wykup obowiązuje
              gdy horyzont &lt; zapadalność. Obligacje indeksowane inflacją (COI, EDO, ROS, ROD)
              mają stałą stopę w 1. roku, potem inflacja + marża. Inflacja pobierana automatycznie
              z ECB (HICP dla Polski). Obligacje ROS i ROD to obligacje rodzinne (program 800+).
              Stawki odpowiadają aktualnej ofercie z obligacjeskarbowe.pl — mogą się zmieniać co miesiąc.
            </p>
          </section>

          {/* 3. Trzymanie akcji */}
          <section className="space-y-1">
            <h3 className="font-semibold text-slate-900">3. Trzymanie akcji (scenariusz)</h3>
            <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-xs space-y-1">
              <div>Cena przyszła = Cena dziś × (1 + Δ ceny akcji%)</div>
              <div>Kurs przyszły = Kurs dziś × (1 + Δ kursu USD/PLN%)</div>
              <div>Wartość brutto = Liczba akcji × Cena przyszła × Kurs przyszły</div>
              <div>Jeśli wartość brutto &gt; kapitał (zysk):</div>
              <div className="pl-4">Zysk netto = (Wartość brutto − Kapitał) × (1 − 0,19)</div>
              <div className="pl-4 font-semibold">Wartość końcowa = Kapitał + Zysk netto</div>
              <div>Jeśli wartość brutto ≤ kapitał (strata):</div>
              <div className="pl-4 font-semibold">Wartość końcowa = Wartość brutto</div>
            </div>
            <p className="text-xs text-slate-600">
              Podatek Belki (19%) jest pobierany tylko od zysku. W przypadku straty — brak podatku,
              więc końcowa wartość to pełna kwota (bez potrąceń).
            </p>
          </section>

          {/* 4. Sugestie z historii */}
          <section className="space-y-1">
            <h3 className="font-semibold text-slate-900">4. Sugestie z danych historycznych</h3>
            <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-xs space-y-1">
              <div>σ dzienne = odchylenie standardowe dziennych stóp zwrotu</div>
              <div>σ roczne = σ dzienne × √252</div>
              <div>σ horyzont = σ roczne × √(miesiące ÷ 12)</div>
              <div>ρ = korelacja Pearsona (stopy zwrotu akcji vs. USD/PLN)</div>
              <div className="pt-1">Bear: Δ akcji = −σ<sub>horyzont</sub>, Δ FX = ρ × σ<sub>FX horyzont</sub></div>
              <div>Base: Δ akcji = średnia stopa zwrotu, Δ FX = średnia</div>
              <div>Bull: Δ akcji = +σ<sub>horyzont</sub>, Δ FX = ρ × σ<sub>FX horyzont</sub></div>
            </div>
            <p className="text-xs text-slate-600">
              Korelacja (ρ) sprawia, że scenariusze są realistyczne. Np. jeśli historycznie
              gdy akcje spadały, dolar umacniał się wobec PLN (ujemna korelacja), to w scenariuszu
              Bear kurs USD/PLN wzrośnie (co częściowo amortyzuje straty). Scenariusz Base
              bazuje na średnim trendzie, nie na zerowej zmianie.
            </p>
          </section>

          {/* 5. Oś czasu */}
          <section className="space-y-1">
            <h3 className="font-semibold text-slate-900">5. Wykres wartości w czasie</h3>
            <p className="text-xs text-slate-600">
              Scenariuszowe zmiany cen (Δ akcji, Δ FX) są skalowane liniowo do każdego miesiąca.
              Np. jeśli w scenariuszu Bull Δ akcji = +15% na 6 miesięcy, to po 3 miesiącach
              przyjmujemy +7,5%. Jest to przybliżenie — rzeczywiste zwroty kumulują się
              geometrycznie, ale dla krótkich horyzontów (1–24 mies.) różnica jest minimalna.
            </p>
          </section>

          {/* 6. Heatmapa */}
          <section className="space-y-1">
            <h3 className="font-semibold text-slate-900">6. Mapa break-even</h3>
            <p className="text-xs text-slate-600">
              Siatka 11×11 kombinacji (Δ ceny akcji × Δ kursu USD/PLN) od −20% do +20%.
              Dla każdej kombinacji obliczamy wartość końcową akcji (po podatku) i porównujemy
              z wartością benchmarku (konto lub obligacje). Zielone komórki = akcje biją benchmark.
            </p>
          </section>

          {/* Założenia */}
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
                <strong>Dane historyczne (~90 dni)</strong> — zmienność i korelacja mogą się
                zmieniać; przeszłość nie gwarantuje przyszłości
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
