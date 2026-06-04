import type { Position } from '../../types/position';

interface PositionListProps {
  positions: Position[];
  onRemove: (id: string) => void;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', PLN: 'zł',
};

export function PositionList({ positions, onRemove }: PositionListProps) {
  if (positions.length === 0) {
    return (
      <div className="text-center py-12 rounded-xl border border-dashed border-bg-muted">
        <p className="text-text-muted text-sm">Brak pozycji. Dodaj pierwszą pozycję powyżej.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-bg-muted">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-bg-muted bg-bg-muted/40">
            <th className="text-left px-4 py-3 text-text-secondary font-medium">Ticker</th>
            <th className="text-right px-4 py-3 text-text-secondary font-medium">Ilość</th>
            <th className="text-right px-4 py-3 text-text-secondary font-medium">Śr. cena</th>
            <th className="text-right px-4 py-3 text-text-secondary font-medium">Waluta</th>
            <th className="text-center px-4 py-3 text-text-secondary font-medium">Źródło</th>
            <th className="px-4 py-3" aria-label="Usuń" />
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const sym = CURRENCY_SYMBOLS[p.currency] ?? p.currency;
            return (
              <tr key={p.id} className="border-b border-bg-muted last:border-0 hover:bg-bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-mono font-semibold text-text-primary">{p.ticker}</td>
                <td className="px-4 py-3 text-right text-text-primary tabular-nums">
                  {p.quantity.toLocaleString('pl-PL', { maximumFractionDigits: 4 })}
                </td>
                <td className="px-4 py-3 text-right text-text-primary tabular-nums">
                  {sym}{p.avgPrice.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right text-text-muted">{p.currency}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-neutral/10 text-neutral">
                    {p.source}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    className="text-text-muted hover:text-loss transition-colors text-xs"
                    aria-label={`Usuń ${p.ticker}`}
                  >
                    Usuń
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
