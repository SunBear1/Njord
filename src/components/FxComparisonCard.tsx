import { ArrowDownUp, RefreshCw } from 'lucide-react';
import type { KantorRates } from '../hooks/useKantorRates';

interface FxComparisonCardProps {
  rates: KantorRates;
}

function spreadPct(buy: number, sell: number): string {
  return ((sell - buy) / ((sell + buy) / 2) * 100).toFixed(2);
}

export function FxComparisonCard({ rates }: FxComparisonCardProps) {
  const { alior, nbp, isLoading, error } = rates;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-400 flex items-center gap-1.5">
        <RefreshCw size={11} className="animate-spin" />
        Pobieram kursy kantorów…
      </div>
    );
  }

  if (error && !alior && !nbp) return null;

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
        <ArrowDownUp size={12} />
        Kursy kupna/sprzedaży USD
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 text-xs items-center">
        {/* Header */}
        <div className="text-gray-400 font-medium">Źródło</div>
        <div className="text-gray-400 font-medium text-right">Kupno</div>
        <div className="text-gray-400 font-medium text-right">Sprzedaż</div>
        <div className="text-gray-400 font-medium text-right">Spread</div>

        {/* Alior row */}
        {alior && (
          <>
            <div className="text-gray-700 font-medium">
              <a
                href="https://kantor.aliorbank.pl"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 underline decoration-dotted"
              >
                Alior Kantor
              </a>
            </div>
            <div className="text-right font-mono text-green-700">{alior.buy.toFixed(4)}</div>
            <div className="text-right font-mono text-red-600">{alior.sell.toFixed(4)}</div>
            <div className="text-right text-gray-500">{spreadPct(alior.buy, alior.sell)}%</div>
          </>
        )}

        {/* NBP row */}
        {nbp && (
          <>
            <div className="text-gray-700 font-medium">
              <a
                href="https://www.nbp.pl/home.aspx?f=/kursy/kursyc.html"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 underline decoration-dotted"
              >
                NBP (tabela C)
              </a>
            </div>
            <div className="text-right font-mono text-green-700">{nbp.buy.toFixed(4)}</div>
            <div className="text-right font-mono text-red-600">{nbp.sell.toFixed(4)}</div>
            <div className="text-right text-gray-500">{spreadPct(nbp.buy, nbp.sell)}%</div>
          </>
        )}
      </div>

      <div className="text-[10px] text-gray-400 leading-snug">
        Kupno = ile PLN dostaniesz sprzedając 1 USD. Sprzedaż = ile PLN zapłacisz kupując 1 USD.
        {alior && <span> Alior: live. </span>}
        {nbp && <span>NBP: {nbp.date}.</span>}
      </div>
    </div>
  );
}
