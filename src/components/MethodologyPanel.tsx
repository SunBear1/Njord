import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

export function MethodologyPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-bg-muted border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-text-primary font-medium hover:bg-bg-muted transition-colors"
      >
        <span className="flex items-center gap-2">
          <BookOpen size={16} aria-hidden="true" />
          Jak obliczamy wyniki? (metodologia)
        </span>
        {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>

      {open && (
        <div className="px-5 py-4 border-t border-border text-sm text-text-primary space-y-5">

          {/* 1. Wartość bieżąca */}
          <section className="space-y-1">
            <h3 className="font-semibold text-text-primary">1. Wartość bieżąca portfela</h3>
            <div className="bg-bg-card border border-border rounded-lg p-3 font-mono text-xs">
              Wartość<sub>PLN</sub> = Liczba akcji × Cena akcji<sub>USD</sub> × Kurs kantor<sub>kupno</sub>
            </div>
            <p className="text-xs text-text-muted">
              Punkt startowy obu scenariuszy — kwota, którą masz dziś w akcjach,
              wyrażona w PLN po przeliczeniu po <strong>kursie kantorowym (kupno)</strong>, czyli
              ile faktycznie dostaniesz, sprzedając dolary.
            </p>
          </section>

          {/* 2a. Konto oszczędnościowe */}
          <section className="space-y-1">
            <h3 className="font-semibold text-text-primary">2a. Konto oszczędnościowe</h3>
            <div className="bg-bg-card border border-border rounded-lg p-3 font-mono text-xs space-y-1">
              <div>Stopa miesięczna = Oprocentowanie roczne ÷ 12</div>
              <div>Wartość brutto = Kapitał × (1 + stopa miesięczna)<sup>n miesięcy</sup></div>
              <div>Odsetki brutto = Wartość brutto − Kapitał</div>
              <div>Odsetki netto = Odsetki brutto × (1 − 0,19)</div>
              <div className="font-semibold">Wartość końcowa = Kapitał + Odsetki netto</div>
            </div>
            <p className="text-xs text-text-muted">
              Kapitalizacja miesięczna. Podatek Belki (19%) naliczany od wypracowanych odsetek.
              Oprocentowanie jest prognozowane modelem <strong>mean-reversion</strong> — bieżąca stopa stopniowo
              zbliża się do długoterminowej równowagi (~3,0%), co odzwierciedla cykliczność stóp procentowych NBP.
            </p>
          </section>

          {/* 2b. Obligacje skarbowe */}
          <section className="space-y-1">
            <h3 className="font-semibold text-text-primary">2b. Obligacje skarbowe</h3>
            <div className="bg-bg-card border border-border rounded-lg p-3 font-mono text-xs space-y-1">
              <div className="font-semibold">Obligacje kapitalizowane (OTS, TOS, EDO, ROS, ROD):</div>
              <div className="pl-4">Rok 1: Wartość × (1 + stopa 1. roku)</div>
              <div className="pl-4">Rok 2+: Wartość × (1 + stopa efektywna) za każdy pełny rok</div>
              <div className="pl-4">Niepełny rok: Wartość × (1 + stopa ÷ 12)<sup>miesiące</sup></div>
              <div className="pl-4">Podatek Belki od łącznego zysku przy wykupie</div>
              <div className="pt-1 font-semibold">Obligacje kuponowe (ROR, DOR, COI):</div>
              <div className="pl-4">Kupon brutto = Kapitał × stopa × (interwał ÷ 12)</div>
              <div className="pl-4">Kupon netto = Kupon brutto × (1 − 0,19) — Belka od każdego kuponu</div>
              <div className="pl-4">Kupony reinwestowane na koncie oszczędnościowym do końca horyzontu</div>
              <div className="pl-4">Zysk z reinwestycji opodatkowany osobno (Belka 19%)</div>
              <div className="pt-1">Stopa efektywna zależy od typu:</div>
              <div className="pl-4">Stałoprocentowe (OTS, TOS): stopa = stała przez cały okres</div>
              <div className="pl-4">Zmiennoprocentowe (ROR, DOR): stopa = stopa ref. NBP + marża</div>
              <div className="pl-4">Indeksowane inflacją (COI, EDO, ROS, ROD): stopa = inflacja + marża</div>
              <div className="pt-1">Kara za wcześniejszy wykup (jeśli horyzont &lt; zapadalność):</div>
              <div className="pl-4">Odejmowana PRZED naliczeniem podatku</div>
              <div className="pl-4">Niektóre obligacje nie pozwalają na wcześniejszy wykup (OTS, TOS)</div>
            </div>
            <p className="text-xs text-text-muted">
              Kapitalizacja roczna. Obligacje indeksowane inflacją (COI, EDO, ROS, ROD) mają stałą stopę
              w 1. roku, potem inflacja CPI + marża (prognozowana modelem mean-reversion).
              Inflacja pobierana automatycznie z Eurostat HICP.
              Stawki odpowiadają aktualnej ofercie z obligacjeskarbowe.pl — mogą się zmieniać co miesiąc.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded px-2 py-1">
              ⚠️ Model nie uwzględnia rolowania (ponownego zakupu) obligacji po zapadalności.
              Jeśli horyzont &gt; zapadalność (np. OTS 3-mies. przy 9-mies. horyzoncie),
              wynik odzwierciedla prostą ekstrapolację stopy, nie trzykrotny zakup obligacji.
            </p>
          </section>

          {/* 3. Trzymanie akcji */}
          <section className="space-y-1">
            <h3 className="font-semibold text-text-primary">3. Trzymanie akcji (scenariusz)</h3>
            <div className="bg-bg-card border border-border rounded-lg p-3 font-mono text-xs space-y-1">
              <div>Cena przyszła = Cena dziś × (1 + Δ ceny akcji%)</div>
              <div>Kurs przyszły = Kurs kantorowy × (1 + Δ kursu USD/PLN%)</div>
              <div className="font-semibold pt-1">Wartość brutto (to co dostaniesz w PLN):</div>
              <div className="pl-4">Brutto = Liczba akcji × Cena przyszła × Kurs przyszły<sub>kantor</sub></div>
              <div className="font-semibold pt-1">Podstawa podatkowa (do obliczenia Belki):</div>
              <div className="pl-4">Koszt uzyskania = Akcje × Cena dziś × Kurs NBP<sub>dziś</sub></div>
              <div className="pl-4">Przychód = Akcje × Cena przyszła × Kurs NBP<sub>przyszły</sub></div>
              <div className="pl-4">Zysk podatkowy = Przychód − Koszt (jeśli &gt; 0)</div>
              <div className="pl-4">Podatek = Zysk podatkowy × 19%</div>
              <div className="font-semibold pt-1">Wartość netto = Brutto<sub>kantor</sub> − Podatek<sub>NBP</sub></div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded px-2 py-1.5 text-xs text-blue-800 dark:text-blue-200 flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 mt-0.5 shrink-0">💱</span>
              <span>
                <strong>Dwa kursy:</strong> Wycena portfela w PLN używa kursu <strong>Alior Kantor (kupno)</strong> — tyle
                faktycznie dostaniesz, sprzedając USD. Podatek Belki obliczany jest po kursie <strong>NBP (tabela A, kurs średni)</strong>,
                zgodnie z polskim prawem podatkowym (PIT-38).
              </span>
            </div>
          </section>

          {/* 4. Sugestie z historii */}
          <section className="space-y-1">
            <h3 className="font-semibold text-text-primary">4. Scenariusze z danych historycznych</h3>
            <div className="bg-bg-card border border-border rounded-lg p-3 font-mono text-xs space-y-1">
              <div className="font-semibold">Dobór modelu (warstwowy):</div>
              <div className="pl-4">Horyzont ≤ 6 mies. → Block Bootstrap (3 000 ścieżek, blok 5 dni)</div>
              <div className="pl-4">Horyzont &gt; 6 mies. → Kalibrowany GBM (formuła zamknięta)</div>
              <div className="pt-1 font-semibold">GBM — Geometryczny Ruch Browna z rozkładem Studenta (ν=5):</div>
              <div className="pl-4">S(T)/S(0) = exp((μ − σ²/2)·T + σ·√T·z)</div>
              <div className="pl-4">Bear (p25) / Base (p50) / Bull (p75) — kwartyle, nie skrajne percentyle</div>
              <div className="pt-1 font-semibold">Kalibracja dryfu (drift shrinkage):</div>
              <div className="pl-4">μ = w × μ<sub>hist</sub> + (1 − w) × 8%  (długoterminowa premia rynkowa)</div>
              <div className="pl-4">w = min(1, lata danych ÷ 10) — z 1 rokiem: 90% prior, 10% historyczny</div>
              <div className="pt-1 font-semibold">Tłumienie zmienności (horyzonty &gt; 2 lata):</div>
              <div className="pl-4">σ<sub>eff</sub> = σ × max(0,75 ; 1 − 0,015 × (T − 2))</div>
              <div className="pl-4">Efekt: przy 12 latach dampFactor ≈ 0,85 — odzwierciedla mean-reversion</div>
              <div className="pt-1 font-semibold">Ograniczenia (hard clamp):</div>
              <div className="pl-4">Roczny zwrot: [−80%, +100%] | Całkowity: [−95%, +1000%]</div>
              <div className="pt-1">σ dzienne, ρ (korelacja Pearsona) — ~2 lata danych historycznych</div>
              <div>Δ FX Bear = −ρ × |FX p95|,  Δ FX Bull = +ρ × |FX p95|</div>
              <div className="pt-1 text-text-faint">HMM (Hidden Markov Model) — informacyjnie: detekcja reżimu rynkowego (wzrost/spadek). Nie wpływa na scenariusze.</div>
            </div>
            <p className="text-xs text-text-muted">
              Scenariusze to zakresy prawdopodobieństwa, nie prognozy. Żaden model nie jest w stanie
              przewidzieć przyszłych cen akcji. Drift shrinkage zapobiega ekstrapolacji krótkoterminowych
              trendów — nawet jeśli akcje wzrosły +200% w ostatnim roku, model ogranicza oczekiwany zwrot.
              Deterministyczny seed PRNG zapewnia powtarzalność wyników dla tych samych danych.
            </p>
          </section>

          {/* 5. Oś czasu */}
          <section className="space-y-1">
            <h3 className="font-semibold text-text-primary">5. Wykres wartości w czasie</h3>
            <div className="bg-bg-card border border-border rounded-lg p-3 font-mono text-xs space-y-1">
              <div>Ułamek czasu: f = m / H (miesiąc m z horyzontu H)</div>
              <div>Δ<sub>m</sub> = (1 + Δ)<sup>f</sup> − 1  (interpolacja geometryczna)</div>
            </div>
            <p className="text-xs text-text-muted">
              Scenariuszowe zmiany cen (Δ akcji, Δ FX) są skalowane <strong>geometrycznie</strong> do każdego
              miesiąca — odzwierciedla to multiplikatywną naturę stóp zwrotu. Np. jeśli w scenariuszu
              Bull Δ akcji = +15% na 6 miesięcy, to po 3 miesiącach przyjmujemy
              (1,15)<sup>0,5</sup> − 1 ≈ +7,2% (nie +7,5% jak przy liniowej interpolacji).
            </p>
          </section>

          {/* 6. Heatmapa */}
          <section className="space-y-1">
            <h3 className="font-semibold text-text-primary">6. Mapa break-even</h3>
            <p className="text-xs text-text-muted">
              Siatka 11×11 kombinacji (Δ ceny akcji × Δ kursu USD/PLN) od −20% do +20%.
              Dla każdej kombinacji obliczamy wartość końcową akcji (po podatku) i porównujemy
              z wartością benchmarku (konto lub obligacje). Zielone komórki = akcje biją benchmark.
            </p>
          </section>

          {/* 7. Korekta o inflację */}
          <section className="space-y-1">
            <h3 className="font-semibold text-text-primary">7. Korekta o inflację (zwrot realny)</h3>
            <div className="bg-bg-card border border-border rounded-lg p-3 font-mono text-xs">
              Inflacja<sub>skumulowana</sub> = (1 + r<sub>CPI</sub>)<sup>T</sup> − 1<br />
              Zwrot<sub>realny</sub> = (1 + Zwrot<sub>nominalny</sub>) / (1 + Inflacja<sub>skumulowana</sub>) − 1
            </div>
            <p className="text-xs text-text-muted">
              Stosujemy dokładny wzór Fishera. Stopa inflacji pochodzi z danych Eurostat (HICP, miesięczne).
              Zamiast stałej stawki na cały horyzont, używamy modelu <strong>mean-reversion</strong>:{' '}
              <code className="bg-bg-muted px-1 rounded text-[11px]">rate(t) = 2,5% + (r₀ − 2,5%) × e<sup>−t/18</sup></code>{' '}
              — bieżąca inflacja stopniowo powraca do celu NBP (2,5%).
              Obliczona jest efektywna średnia roczna stawka dla konkretnego horyzontu.
            </p>
          </section>

          <section className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-lg p-3 space-y-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200">Założenia i ograniczenia</h3>
            <ul className="list-disc list-inside text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <li>
                <strong>Podatek Belki (19%)</strong> od zysku zarówno z akcji, jak i z odsetek
              </li>
              <li>
                <strong>Dwa kursy walutowe:</strong> wycena portfela po kursie kantorowym (Alior, kupno);
                podstawa podatku Belki po kursie NBP (tabela A, średni) — zgodnie z PIT-38
              </li>
              <li>
                <strong>Baza podatkowa = wartość bieżąca.</strong> Porównujemy marginalny zysk
                od teraz. Podatek od dotychczasowego zysku nie wpływa na wybór „trzymać vs. sprzedać"
              </li>
              <li>
                <strong>Prowizja maklerska</strong> — opcjonalna, odejmowana od wartości sprzedaży
                i zaliczana jako koszt uzyskania przychodu (pomniejsza podstawę Belki)
              </li>
              <li>
                <strong>Brak rolowania obligacji.</strong> Jeśli horyzont &gt; zapadalność (np. OTS 3 mies. przy 9 mies.),
                wynik ekstrapoluje stopę — nie modeluje ponownego zakupu obligacji
              </li>
              <li>
                <strong>Dywidendy</strong> — opcjonalne; akumulowane za cały horyzont, opodatkowane 19%
                (pokrywa US WHT 15% + dopłata PL 4%)
              </li>
              <li>
                <strong>Inflacja — model mean-reversion</strong> — prognozujemy zbieżność bieżącej
                stawki HICP do celu NBP (2,5%); to przybliżenie, nie prognoza
              </li>
              <li>
                <strong>Dane historyczne (~2 lata)</strong> — zmienność i korelacja mogą się
                zmieniać; przeszłość nie gwarantuje przyszłości
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
