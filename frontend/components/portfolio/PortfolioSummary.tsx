import { fmtPLN, fmtPercent } from '../../utils/formatting';

interface PortfolioSummaryProps {
  stockValuePLN: number;
  bondValuePLN: number;
  savingsValuePLN: number;
  totalPLN: number;
  isConverting: boolean;
  conversionError: string | null;
}

interface StatTile {
  label: string;
  value: number;
  dotClass: string;
}

export function PortfolioSummary({
  stockValuePLN,
  bondValuePLN,
  savingsValuePLN,
  totalPLN,
  isConverting,
  conversionError,
}: PortfolioSummaryProps) {
  const tiles: StatTile[] = [
    { label: 'Akcje i ETF', value: stockValuePLN, dotClass: 'bg-chart-stocks' },
    { label: 'Obligacje', value: bondValuePLN, dotClass: 'bg-chart-bonds' },
    { label: 'Oszczędności', value: savingsValuePLN, dotClass: 'bg-chart-savings' },
  ];

  return (
    <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
      <div>
        <p className="text-sm text-text-secondary">Łączna wartość portfela</p>
        <p className="text-3xl font-bold text-text-primary">
          {fmtPLN(totalPLN)}
          {isConverting && <span className="ml-2 text-sm font-normal text-text-muted">przeliczanie kursów…</span>}
        </p>
        {conversionError && <p className="mt-1 text-xs text-loss">{conversionError}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg bg-bg-hover p-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${tile.dotClass}`} aria-hidden="true" />
              <p className="text-xs text-text-secondary">{tile.label}</p>
            </div>
            <p className="mt-1 text-lg font-semibold text-text-primary">{fmtPLN(tile.value)}</p>
            <p className="text-xs text-text-muted">
              {totalPLN > 0 ? fmtPercent((tile.value / totalPLN) * 100) : '0,0%'} portfela
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
