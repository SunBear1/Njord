/**
 * PrivacyPolicy — static RODO/GDPR disclosure (Polish).
 * Linked from the footer. Documents what data is stored and how to erase it.
 */

interface Props {
  onClose: () => void;
}

export function PrivacyPolicy({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-label="Polityka prywatności">
      <div className="bg-bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-bg-card flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Polityka prywatności</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-2xl leading-none"
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 text-sm text-text-secondary leading-relaxed">
          <p>
            Njord jest aplikacją działającą wyłącznie w przeglądarce. <strong>Żadne dane osobowe ani finansowe nie są przesyłane na serwery Njord.</strong>
          </p>

          <section>
            <h3 className="font-semibold text-text-primary mb-1">Jakie dane są przechowywane lokalnie?</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>njord_state</strong> — ustawienia zakładki inwestycyjnej: ticker, liczba akcji, horyzont, parametry scenariuszy. Dane te są przechowywane wyłącznie na Twoim urządzeniu w localStorage.</li>
              <li><strong>njord_tax_transactions</strong> — transakcje sprzedaży wprowadzone w kalkulatorze podatku Belka (daty, kwoty, waluty, symbol spółki). Dane finansowe, które mogą stanowić dane osobowe w rozumieniu RODO Art. 4.</li>
              <li><strong>njord_dark_mode</strong> — preferencja trybu ciemnego.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-text-primary mb-1">Co jest wysyłane do zewnętrznych API?</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Symbol tickera</strong> (np. AAPL) — wysyłany do Yahoo Finance oraz Twelve Data w celu pobrania kursu akcji. Nie zawiera danych osobowych.</li>
              <li><strong>Data transakcji</strong> — wysyłana do NBP (api.nbp.pl) wyłącznie w celu pobrania kursu walutowego na dany dzień.</li>
              <li>Żadne kwoty, liczba akcji ani inne dane finansowe nie są wysyłane do zewnętrznych serwisów.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-text-primary mb-1">Infrastruktura i przetwarzanie</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Strona jest hostowana na <strong>Cloudflare Pages</strong>. Cloudflare może przetwarzać adresy IP i podstawowe metadane żądań zgodnie z własną polityką prywatności.</li>
              <li>Dane przekazywane do Yahoo Finance, NBP, ECB i Alior Kantor podlegają regulaminom tych serwisów.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-text-primary mb-1">Prawo do usunięcia danych (RODO Art. 17)</h3>
            <p>
              Ponieważ wszystkie dane przechowywane są wyłącznie w Twojej przeglądarce, możesz je usunąć w dowolnym momencie klikając przycisk <strong>„Wyczyść wszystkie dane"</strong> w stopce aplikacji lub czyszcząc localStorage przeglądarki.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-text-primary mb-1">Pliki cookie</h3>
            <p>
              Njord nie używa plików cookie ani narzędzi analitycznych (Google Analytics, Hotjar itp.). Jedynym mechanizmem przechowywania danych jest localStorage przeglądarki.
            </p>
          </section>

          <p className="text-xs text-text-muted pt-2 border-t border-border">
            Data: 2025-07-17 · Kontakt w sprawach prywatności: przez repozytorium GitHub (SunBear1/Njord)
          </p>
        </div>
      </div>
    </div>
  );
}
