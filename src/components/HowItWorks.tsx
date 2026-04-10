import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

export function HowItWorks() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-blue-800 font-medium hover:bg-blue-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <HelpCircle size={16} />
          Jak działa ten kalkulator?
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-5 py-4 border-t border-blue-200 text-sm text-blue-900 space-y-3">
          <p>
            <strong>Njord</strong> porównuje, co bardziej się opłaca: trzymać akcje spółki
            (wyceniane w USD) czy sprzedać je i wpłacić środki na konto oszczędnościowe
            w PLN lub zainwestować w obligacje skarbowe.
          </p>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              <strong>Wpisz ticker</strong> (np. <code className="bg-blue-100 px-1 rounded">AAPL</code>,{' '}
              <code className="bg-blue-100 px-1 rounded">NVDA</code>) — aplikacja automatycznie pobierze aktualny kurs akcji,
              kurs USD/PLN z NBP oraz historyczną zmienność.
            </li>
            <li>
              <strong>Uzupełnij dane</strong>: liczbę posiadanych akcji, wybierz benchmark
              (konto oszczędnościowe lub obligacje skarbowe) i horyzont czasowy.
            </li>
            <li>
              <strong>Dostosuj scenariusze</strong> Bear/Base/Bull — możesz zaakceptować
              automatycznie wyliczone zakresy z historycznej zmienności lub wpisać własne wartości.
            </li>
            <li>
              <strong>Odczytaj wynik</strong> — kalkulator pokaże dla każdego scenariusza,
              która opcja jest lepsza i o ile złotych.
            </li>
          </ol>
          <div className="bg-blue-100 rounded-lg p-3 text-xs">
            <strong>Uwaga:</strong> Kalkulator uwzględnia podatek Belki (19%) zarówno od zysku
            z akcji, jak i od odsetek z konta oszczędnościowego / obligacji. Wpływ inflacji na realną
            wartość zysku wyświetlany jest osobno. Nie uwzględnia prowizji
            maklerskich ani różnic kursowych przy wymianie walut.
          </div>
        </div>
      )}
    </div>
  );
}
