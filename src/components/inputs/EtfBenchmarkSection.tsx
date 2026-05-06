import { Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Tooltip } from '../Tooltip';

interface EtfBenchmarkSectionProps {
  etfTicker: string;
  etfLoading: boolean;
  etfError: string | null;
  etfName: string | null;
  etfAnnualReturnPercent: number;
  onEtfAnnualReturnChange: (v: number) => void;
  onEtfTickerChange: (ticker: string) => void;
  onFetchEtf: (ticker: string) => void;
}

export function EtfBenchmarkSection({
  etfTicker,
  etfLoading,
  etfError,
  etfName,
  etfAnnualReturnPercent,
  onEtfAnnualReturnChange,
  onEtfTickerChange,
  onFetchEtf,
}: EtfBenchmarkSectionProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="etf-ticker" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
          Ticker ETF
          <Tooltip content="Ticker funduszu ETF, do którego porównujesz reinwestycję. Przykłady: IWDA.L, VWCE.DE, CSPX.L, SPY." />
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const nextTicker = etfTicker.trim().toUpperCase();
            if (!nextTicker) return;
            onEtfTickerChange(nextTicker);
            onFetchEtf(nextTicker);
          }}
          className="flex gap-2"
        >
          <input
            id="etf-ticker"
            name="etfTicker"
            autoComplete="off"
            spellCheck={false}
            type="text"
            value={etfTicker}
            onChange={(event) => onEtfTickerChange(event.target.value.toUpperCase())}
            placeholder="np. IWDA.L"
            className="flex-1 border border-border rounded-lg bg-bg-card px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
          />
          <button
            type="submit"
            disabled={etfLoading || !etfTicker.trim()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-accent-interactive text-text-on-accent rounded-lg hover:bg-accent-interactive/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Pobierz dane ETF"
          >
            {etfLoading
              ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              : <RefreshCw size={14} aria-hidden="true" />}
            Pobierz
          </button>
        </form>
        {etfError && (
          <p className="text-xs text-danger flex items-center gap-1">
            <AlertCircle size={12} aria-hidden="true" /> {etfError}
          </p>
        )}
        {etfName && !etfError && !etfLoading && (
          <p className="text-xs text-success flex items-center gap-1">
            <CheckCircle2 size={12} aria-hidden="true" /> {etfName}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="etf-return" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
          Roczny zwrot ETF (% p.a.)
          <Tooltip content="Historyczny CAGR funduszu. Po pobraniu danych wypełnia się automatycznie, ale możesz go nadpisać własnym założeniem." />
        </label>
        <input
          id="etf-return"
          name="etfReturn"
          autoComplete="off"
          type="number"
          min={-20}
          max={30}
          step={0.1}
          value={etfAnnualReturnPercent || ''}
          onChange={(event) => onEtfAnnualReturnChange(Number(event.target.value))}
          placeholder="np. 8,0"
          className="w-full border border-border rounded-lg bg-bg-card px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
        />
      </div>
    </div>
  );
}
