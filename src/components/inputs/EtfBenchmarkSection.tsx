/**
 * EtfBenchmarkSection — ETF ticker input, return rate and TER configuration.
 * Rendered inside InputPanel when benchmarkType === 'etf'.
 */
import { Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Tooltip } from '../Tooltip';

interface EtfBenchmarkSectionProps {
  localEtfTicker: string;
  onLocalEtfTickerChange: (v: string) => void;
  etfLoading: boolean;
  etfError: string | null;
  etfName: string | null;
  etfAnnualReturnPercent: number;
  etfTerPercent: number;
  onEtfAnnualReturnChange: (v: number) => void;
  onEtfTerChange: (v: number) => void;
  onEtfTickerChange: (ticker: string) => void;
  onFetchEtf: (ticker: string) => void;
}

export function EtfBenchmarkSection({
  localEtfTicker,
  onLocalEtfTickerChange,
  etfLoading,
  etfError,
  etfName,
  etfAnnualReturnPercent,
  etfTerPercent,
  onEtfAnnualReturnChange,
  onEtfTerChange,
  onEtfTickerChange,
  onFetchEtf,
}: EtfBenchmarkSectionProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="etf-ticker" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
          Ticker ETF
          <Tooltip content="Ticker funduszu ETF, w który reinwestujesz zyski ze sprzedaży akcji. Przykłady: IWDA.L, VWCE.DE, CSPX.L, SPY. Europejskie ETF wymagają sufiksu giełdy (np. .L, .AS, .DE)." />
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = localEtfTicker.trim().toUpperCase();
            if (t) { onEtfTickerChange(t); onFetchEtf(t); }
          }}
          className="flex gap-2"
        >
          <input
            id="etf-ticker"
            name="etfTicker"
            autoComplete="off"
            spellCheck={false}
            type="text"
            value={localEtfTicker}
            onChange={(e) => onLocalEtfTickerChange(e.target.value.toUpperCase())}
            placeholder="np. IWDA.L"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-bg-muted dark:border-border-strong dark:text-text-primary dark:placeholder-text-faint"
          />
          <button
            type="submit"
            disabled={etfLoading || !localEtfTicker.trim()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Pobierz dane ETF"
          >
            {etfLoading
              ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              : <RefreshCw size={14} aria-hidden="true" />}
            Pobierz
          </button>
        </form>
        {etfError && (
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle size={12} aria-hidden="true" /> {etfError}
          </p>
        )}
        {etfName && !etfError && !etfLoading && (
          <p className="text-xs text-teal-600 dark:text-cyan-400 flex items-center gap-1">
            <CheckCircle2 size={12} aria-hidden="true" /> {etfName}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="etf-return" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
          Roczny zwrot ETF (% p.a.)
          <Tooltip content="Historyczny CAGR funduszu przed odliczeniem TER — wypełniany automatycznie po pobraniu danych. Możesz go nadpisać własną wartością. Przykład: VWCE/IWDA ≈ 8–10% długoterminowo." />
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
          onChange={(e) => onEtfAnnualReturnChange(Number(e.target.value))}
          placeholder="np. 8.0"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-bg-muted dark:border-border-strong dark:text-text-primary dark:placeholder-text-faint"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="etf-ter" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
          TER — opłata za zarządzanie (% rocznie)
          <Tooltip content="Total Expense Ratio — roczna opłata funduszu za zarządzanie, automatycznie odejmowana od wartości. Przykład: VWCE 0.22%, CSPX/IWDA 0.07%, iShares Core S&P 500 0.07%." />
        </label>
        <input
          id="etf-ter"
          name="etfTer"
          autoComplete="off"
          type="number"
          min={0}
          max={5}
          step={0.01}
          value={etfTerPercent || ''}
          onChange={(e) => onEtfTerChange(Number(e.target.value))}
          placeholder="np. 0.07"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-bg-muted dark:border-border-strong dark:text-text-primary dark:placeholder-text-faint"
        />
      </div>

      {etfAnnualReturnPercent > 0 && (
        <p className="text-xs text-text-muted px-1">
          Efektywny zwrot netto: <strong>{(etfAnnualReturnPercent - etfTerPercent).toFixed(2)}%</strong>/rok (przed Belką).
          Podwójna Belka 19%: przy sprzedaży akcji i przy wyjściu z ETF.
        </p>
      )}
    </div>
  );
}
