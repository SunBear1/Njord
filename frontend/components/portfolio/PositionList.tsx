import type { Position } from '../../types/position';
import type { PortfolioQuality } from '../../utils/portfolioQuality';

interface PositionListProps {
  positions: Position[];
  quality: PortfolioQuality;
  editingId: string | null;
  onEdit: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', PLN: 'zł',
};

function QualityBadge({ score, missingFields }: { score: number; missingFields: string[] }) {
  if (score === 100) {
    return (
      <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-profit/10 text-profit font-medium">
        kompletna
      </span>
    );
  }
  return (
    <span
      className="inline-block px-2 py-0.5 text-xs rounded-full bg-loss/10 text-loss font-medium cursor-help"
      title={`Brakuje: ${missingFields.join(', ')}`}
    >
      niekompletna
    </span>
  );
}

function FreshnessIndicator({ isStale, addedAt }: { isStale: boolean; addedAt: number }) {
  const date = new Date(addedAt).toLocaleDateString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  if (!isStale) {
    return <span className="text-xs text-text-muted" title={`Dodano: ${date}`}>świeże</span>;
  }
  return (
    <span
      className="text-xs text-loss font-medium"
      title={`Dodano: ${date}. Dane starsze niż 24h.`}
    >
      ⚠ stare
    </span>
  );
}

export function PositionList({ positions, quality, editingId, onEdit, onDeleteRequest }: PositionListProps) {
  if (positions.length === 0) {
    return (
      <div className="text-center py-12 rounded-xl border border-dashed border-bg-muted">
        <p className="text-text-muted text-sm">Brak pozycji. Dodaj pierwszą pozycję powyżej.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Quality summary */}
      <div className="flex items-center gap-4 px-1 text-sm text-text-secondary">
        <span>
          Jakość portfela:{' '}
          <span className={`font-semibold ${quality.overallScore >= 90 ? 'text-profit' : quality.overallScore >= 70 ? 'text-neutral' : 'text-loss'}`}>
            {quality.overallScore}%
          </span>
        </span>
        <span className="text-text-muted">·</span>
        <span>{quality.completeCount} / {quality.totalCount} kompletnych</span>
        {quality.staleCount > 0 && (
          <>
            <span className="text-text-muted">·</span>
            <span className="text-loss">{quality.staleCount} przeterminowanych</span>
          </>
        )}
      </div>

      {/* Positions table */}
      <div className="overflow-x-auto rounded-xl border border-bg-muted">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bg-muted bg-bg-muted/40">
              <th className="text-left px-4 py-3 text-text-secondary font-medium">Ticker</th>
              <th className="text-right px-4 py-3 text-text-secondary font-medium">Ilość</th>
              <th className="text-right px-4 py-3 text-text-secondary font-medium">Śr. cena</th>
              <th className="text-right px-4 py-3 text-text-secondary font-medium">Waluta</th>
              <th className="text-center px-4 py-3 text-text-secondary font-medium">Jakość</th>
              <th className="text-center px-4 py-3 text-text-secondary font-medium">Świeżość</th>
              <th className="px-4 py-3" aria-label="Akcje" />
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const sym = CURRENCY_SYMBOLS[p.currency] ?? p.currency;
              const q = quality.perPosition.get(p.id);
              const isEditing = editingId === p.id;
              return (
                <tr
                  key={p.id}
                  className={`border-b border-bg-muted last:border-0 transition-colors ${isEditing ? 'bg-neutral/5' : 'hover:bg-bg-muted/20'}`}
                >
                  <td className="px-4 py-3 font-mono font-semibold text-text-primary">{p.ticker}</td>
                  <td className="px-4 py-3 text-right text-text-primary tabular-nums">
                    {p.quantity.toLocaleString('pl-PL', { maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.avgPrice > 0
                      ? <span className="text-text-primary">{sym}{p.avgPrice.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      : <span className="text-text-muted italic text-xs">brak</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right text-text-muted">{p.currency}</td>
                  <td className="px-4 py-3 text-center">
                    {q ? <QualityBadge score={q.score} missingFields={q.missingFields} /> : null}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {q ? <FreshnessIndicator isStale={q.isStale} addedAt={p.addedAt} /> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => onEdit(p.id)}
                        className="text-text-muted hover:text-neutral transition-colors text-xs"
                        aria-label={`Edytuj ${p.ticker}`}
                      >
                        Edytuj
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRequest(p.id)}
                        className="text-text-muted hover:text-loss transition-colors text-xs"
                        aria-label={`Usuń ${p.ticker}`}
                      >
                        Usuń
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
