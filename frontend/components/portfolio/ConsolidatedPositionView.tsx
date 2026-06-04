import type { ConsolidatedPosition } from '../../utils/portfolioConsolidation';

interface ConsolidatedPositionViewProps {
  consolidated: ConsolidatedPosition[];
  onResolve: (ticker: string) => void;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', PLN: 'zł',
};

const CONFLICT_LABELS: Record<string, string> = {
  price: 'konflikt cen',
  quantity: 'konflikt ilości',
  price_and_quantity: 'konflikt cen i ilości',
};

export function ConsolidatedPositionView({ consolidated, onResolve }: ConsolidatedPositionViewProps) {
  const conflicts = consolidated.filter((c) => c.hasConflict);
  if (conflicts.length === 0) return null;

  return (
    <div className="rounded-xl border border-neutral/30 bg-neutral/5 p-4 space-y-3">
      <p className="text-sm font-semibold text-text-primary">
        Skonsolidowany widok — {conflicts.length} konflikty danych
      </p>
      <div className="space-y-3">
        {conflicts.map((c) => {
          const sym = CURRENCY_SYMBOLS[c.currency] ?? c.currency;
          const conflictLabel = c.conflictKind ? CONFLICT_LABELS[c.conflictKind] : 'konflikt';
          return (
            <div key={c.ticker} className="rounded-lg border border-bg-muted bg-bg-card p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold text-text-primary">{c.ticker}</span>
                <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-loss/10 text-loss font-medium">
                  {conflictLabel}
                </span>
              </div>
              <div className="space-y-1">
                {c.sources.map((s) => (
                  <div key={`${s.source}-${s.positionId}`} className="flex items-center gap-3 text-xs text-text-secondary">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-bg-muted text-text-muted font-medium min-w-16 text-center">
                      {s.source}
                    </span>
                    <span className="tabular-nums">
                      {s.quantity.toLocaleString('pl-PL', { maximumFractionDigits: 4 })} szt.
                    </span>
                    {s.avgPrice > 0 && (
                      <span className="tabular-nums">
                        {sym}{s.avgPrice.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onResolve(c.ticker)}
                className="text-xs text-neutral hover:underline"
              >
                Rozwiąż konflikt →
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-text-muted">
        Skonsolidowana ilość i śr. cena ważona są wyliczane ze wszystkich źródeł.
        Kliknij „Rozwiąż konflikt", aby usunąć lub zachować konkretne źródło.
      </p>
    </div>
  );
}
