import type { PortfolioQuality } from '../../utils/portfolioQuality';

interface PortfolioReadinessPanelProps {
  quality: PortfolioQuality;
}

export function PortfolioReadinessPanel({ quality }: PortfolioReadinessPanelProps) {
  if (quality.totalCount === 0 || quality.missingFieldSummaries.length === 0) return null;

  const incompleteCount = quality.totalCount - quality.completeCount;

  return (
    <div className="rounded-xl border border-loss/30 bg-loss/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <span className="text-loss text-base leading-none mt-0.5" aria-hidden="true">⚠</span>
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {incompleteCount} z {quality.totalCount} pozycji niekompletnych
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            Portfel może być używany do analiz z obniżonym poziomem pewności.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {quality.missingFieldSummaries.map((s) => (
          <li key={s.field} className="text-sm">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-medium text-text-primary">Brak: {s.field}</span>
              <span className="text-text-muted">→</span>
              <span className="text-text-secondary italic">{s.impact}</span>
            </div>
            <div className="mt-0.5 text-xs text-text-muted">
              Dotyczy: {s.affectedTickers.join(', ')}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
