import { useState, useCallback } from 'react';
import { Wand2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import type { Scenarios, ScenarioKey } from '../types/scenario';
import type { VolatilityStats } from '../hooks/useHistoricalVolatility';

interface ScenarioEditorProps {
  scenarios: Scenarios;
  onChange: (key: ScenarioKey, field: 'deltaStock' | 'deltaFx', value: number) => void;
  suggestedScenarios: Scenarios | null;
  onApplySuggested: () => void;
  currentPriceUSD: number;
  currentFxRate: number;
  volatilityStats: VolatilityStats | null;
  /** Horizontal compact layout when rendered full-width (InputPanel collapsed) */
  compact?: boolean;
}

type InputMode = 'pct' | 'fixed';

const SCENARIO_CONFIG: { key: ScenarioKey; label: string; accent: string; badge: string; colBg: string }[] = [
  { key: 'bear', label: 'Bear',  accent: 'border-red-300',   badge: 'bg-red-50 text-red-700 border border-red-200',     colBg: 'bg-red-50/40' },
  { key: 'base', label: 'Base',  accent: 'border-amber-300', badge: 'bg-amber-50 text-amber-700 border border-amber-200', colBg: 'bg-amber-50/40' },
  { key: 'bull', label: 'Bull',  accent: 'border-green-300', badge: 'bg-green-50 text-green-700 border border-green-200', colBg: 'bg-green-50/40' },
];

function initValues(s: Scenarios) {
  const fmt = (n: number) => String(parseFloat(n.toFixed(2)));
  return {
    bear: { stock: fmt(s.bear.deltaStock), fx: fmt(s.bear.deltaFx) },
    base: { stock: fmt(s.base.deltaStock), fx: fmt(s.base.deltaFx) },
    bull: { stock: fmt(s.bull.deltaStock), fx: fmt(s.bull.deltaFx) },
  };
}

function ModeToggle({ mode, onToggle, labelA, labelB }: { mode: InputMode; onToggle: () => void; labelA: string; labelB: string }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full rounded border border-gray-200 overflow-hidden text-xs font-medium"
      title="Przełącz tryb wpisywania"
    >
      <span className={`flex-1 text-center py-0.5 ${mode === 'pct' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>{labelA}</span>
      <span className={`flex-1 text-center py-0.5 ${mode === 'fixed' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>{labelB}</span>
    </button>
  );
}

export function ScenarioEditor({
  scenarios,
  onChange,
  suggestedScenarios,
  onApplySuggested,
  currentPriceUSD,
  currentFxRate,
  volatilityStats,
  compact,
}: ScenarioEditorProps) {
  const [stockMode, setStockMode] = useState<InputMode>('pct');
  const [fxMode, setFxMode] = useState<InputMode>('pct');
  const [localValues, setLocalValues] = useState(() => initValues(scenarios));
  const [statsOpen, setStatsOpen] = useState(false);

  const toDelta = useCallback((raw: string, mode: InputMode, currentVal: number): number => {
    const n = parseFloat(raw);
    if (isNaN(n)) return 0;
    if (mode === 'pct') return n;
    return currentVal > 0 ? (n / currentVal - 1) * 100 : 0;
  }, []);

  const handleStockChange = (key: ScenarioKey, raw: string) => {
    setLocalValues(prev => ({ ...prev, [key]: { ...prev[key], stock: raw } }));
    onChange(key, 'deltaStock', toDelta(raw, stockMode, currentPriceUSD));
  };

  const handleFxChange = (key: ScenarioKey, raw: string) => {
    setLocalValues(prev => ({ ...prev, [key]: { ...prev[key], fx: raw } }));
    onChange(key, 'deltaFx', toDelta(raw, fxMode, currentFxRate));
  };

  const toggleStockMode = () => {
    const next: InputMode = stockMode === 'pct' ? 'fixed' : 'pct';
    const updated = { ...localValues };
    (Object.keys(updated) as ScenarioKey[]).forEach(key => {
      const cur = localValues[key].stock;
      if (next === 'fixed' && currentPriceUSD > 0) {
        const pct = parseFloat(cur) || 0;
        updated[key] = { ...updated[key], stock: (currentPriceUSD * (1 + pct / 100)).toFixed(2) };
      } else if (next === 'pct' && currentPriceUSD > 0) {
        const price = parseFloat(cur) || currentPriceUSD;
        const delta = (price / currentPriceUSD - 1) * 100;
        updated[key] = { ...updated[key], stock: delta.toFixed(2) };
        onChange(key, 'deltaStock', delta);
      }
    });
    setLocalValues(updated);
    setStockMode(next);
  };

  const toggleFxMode = () => {
    const next: InputMode = fxMode === 'pct' ? 'fixed' : 'pct';
    const updated = { ...localValues };
    (Object.keys(updated) as ScenarioKey[]).forEach(key => {
      const cur = localValues[key].fx;
      if (next === 'fixed' && currentFxRate > 0) {
        const pct = parseFloat(cur) || 0;
        updated[key] = { ...updated[key], fx: (currentFxRate * (1 + pct / 100)).toFixed(4) };
      } else if (next === 'pct' && currentFxRate > 0) {
        const rate = parseFloat(cur) || currentFxRate;
        const delta = (rate / currentFxRate - 1) * 100;
        updated[key] = { ...updated[key], fx: delta.toFixed(2) };
        onChange(key, 'deltaFx', delta);
      }
    });
    setLocalValues(updated);
    setFxMode(next);
  };


  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${compact ? 'px-4 py-3' : 'p-5'} space-y-3`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className={`font-semibold text-gray-800 ${compact ? 'text-base' : 'text-lg'}`}>Scenariusze</h2>
        {suggestedScenarios && (
          <button
            onClick={onApplySuggested}
            className="flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <Wand2 size={13} />
            Przywróć z historii
          </button>
        )}
      </div>

      {!compact && suggestedScenarios && (
        <p className="text-xs text-gray-400">
          {volatilityStats?.regime
            ? 'Scenariusze z modelu HMM + Monte Carlo na historycznych danych. Base = cena bez zmian. Możesz edytować.'
            : 'Scenariusze statystyczne z historycznych danych. Base = cena bez zmian. Możesz edytować.'}
        </p>
      )}

      {/* Analysis card — compact, collapsible (hidden in compact mode) */}
      {!compact && volatilityStats && (
        <div className="border border-indigo-100 rounded-lg overflow-hidden">
          <button
            onClick={() => setStatsOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-indigo-50 text-xs text-indigo-800 hover:bg-indigo-100 transition-colors"
          >
            <div className="flex flex-col gap-1.5 items-start">
              <span className="flex items-center gap-1.5 font-medium">
                <Info size={12} />
                Analiza historyczna (~2 lata danych)
              </span>
              <span className="flex gap-1.5 flex-wrap">
                {volatilityStats.regime && (
                  <span className={`rounded px-1.5 py-0.5 border font-semibold text-[11px] ${
                    volatilityStats.regime.currentRegimeLabel === 'bull'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {volatilityStats.regime.currentRegimeLabel === 'bull' ? '📈 Wzrost' : '📉 Spadek'}
                    {' '}({Math.round(volatilityStats.regime.posteriorProbability * 100)}%)
                  </span>
                )}
                <span className="bg-white rounded px-1.5 py-0.5 border border-indigo-100 text-[11px] text-indigo-600">
                  σ <strong>{volatilityStats.stockSigmaAnnual.toFixed(0)}%</strong>/rok
                </span>
                <span className={`bg-white rounded px-1.5 py-0.5 border border-indigo-100 text-[11px] font-semibold ${volatilityStats.stockMeanAnnual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {volatilityStats.stockMeanAnnual >= 0 ? '↑' : '↓'} {volatilityStats.stockMeanAnnual >= 0 ? '+' : ''}{volatilityStats.stockMeanAnnual.toFixed(0)}%/rok
                </span>
              </span>
            </div>
            {statsOpen ? <ChevronUp size={13} className="text-indigo-400 shrink-0" /> : <ChevronDown size={13} className="text-indigo-400 shrink-0" />}
          </button>

          {statsOpen && (
            <div className="px-3 py-3 bg-white border-t border-indigo-100 text-xs text-gray-600 space-y-3">

              {/* Key metrics grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg p-2.5 space-y-0.5">
                  <div className="font-semibold text-gray-700">Zmienność akcji</div>
                  <div className="text-lg font-bold text-gray-900">{volatilityStats.stockSigmaAnnual.toFixed(1)}%<span className="text-xs font-normal text-gray-400">/rok</span></div>
                  <div className="text-gray-500">Im wyższa, tym szerszy przedział Bear–Bull. Typowe akcje: 20–40%.</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 space-y-0.5">
                  <div className="font-semibold text-gray-700">Zmienność USD/PLN</div>
                  <div className="text-lg font-bold text-gray-900">{volatilityStats.fxSigmaAnnual.toFixed(1)}%<span className="text-xs font-normal text-gray-400">/rok</span></div>
                  <div className="text-gray-500">Kurs dolara jest dodatkowym źródłem ryzyka dla inwestycji w USD.</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 space-y-0.5">
                  <div className="font-semibold text-gray-700">Powiązanie z dolarem</div>
                  <div className={`text-lg font-bold ${Math.abs(volatilityStats.correlation) > 0.1 ? (volatilityStats.correlation > 0 ? 'text-amber-600' : 'text-blue-600') : 'text-gray-700'}`}>
                    {volatilityStats.correlation > 0 ? '+' : ''}{volatilityStats.correlation.toFixed(2)}
                  </div>
                  <div className="text-gray-500">
                    {volatilityStats.correlation < -0.1
                      ? 'Gdy akcje spadają, dolar się umacnia — częściowo amortyzuje straty.'
                      : volatilityStats.correlation > 0.1
                      ? 'Wzrost/spadek akcji idzie w parze z dolarem — efekty się wzmacniają.'
                      : 'Akcje i USD/PLN zachowują się niezależnie od siebie.'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 space-y-0.5">
                  <div className="font-semibold text-gray-700">Historyczny trend</div>
                  <div className={`text-lg font-bold ${volatilityStats.stockMeanAnnual >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {volatilityStats.stockMeanAnnual >= 0 ? '+' : ''}{volatilityStats.stockMeanAnnual.toFixed(1)}%<span className="text-xs font-normal text-gray-400">/rok</span>
                  </div>
                  <div className="text-gray-500">Tylko informacyjnie — 1 rok to za mało, by traktować to jako prognozę.</div>
                </div>
              </div>

              {/* HMM regime info */}
              {volatilityStats.regime && (
                <div className={`rounded-lg p-2.5 border text-xs ${
                  volatilityStats.regime.currentRegimeLabel === 'bull'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="font-semibold mb-1">
                    {volatilityStats.regime.currentRegimeLabel === 'bull' ? '📈 Faza wzrostów (Bull)' : '📉 Faza spadków (Bear)'}
                    {' — pewność modelu: '}{Math.round(volatilityStats.regime.posteriorProbability * 100)}%
                  </div>
                  <div className="text-xs opacity-80">
                    Zmienność w tej fazie: {volatilityStats.regime.stateSigmasAnnual[volatilityStats.regime.currentState].toFixed(0)}%/rok
                    · Średni trend: {volatilityStats.regime.stateMeansAnnual[volatilityStats.regime.currentState] >= 0 ? '+' : ''}{volatilityStats.regime.stateMeansAnnual[volatilityStats.regime.currentState].toFixed(0)}%/rok
                    · Typowy czas trwania: ~{volatilityStats.regime.expectedDurations[volatilityStats.regime.currentState].toFixed(0)} sesji
                  </div>
                  <div className="text-xs opacity-70 mt-1 italic">
                    Model oparty na ~2 latach danych — wyniki mają charakter orientacyjny, nie prognostyczny.
                  </div>
                </div>
              )}

              {/* Scenario methodology */}
              <div className="border-t pt-2 text-gray-500 leading-relaxed">
                {volatilityStats.regime ? (
                  <>
                    <strong className="text-gray-600">Jak wyliczone?</strong>{' '}
                    Bear/Bull = 5./95. percentyl z 3 000 symulacji Monte Carlo z przejściami między fazami rynku.
                    Base = aktualna cena (0% zmiany).
                  </>
                ) : (
                  <>
                    <strong className="text-gray-600">Jak wyliczone?</strong>{' '}
                    Bear/Bull = 5./95. percentyl rozkładu log-normalnego (zero-dryf, korekta Itô).
                    Base = aktualna cena bez zmian.
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table layout: rows = fields, columns = scenarios */}
      <div className="space-y-2">
        {/* Column headers */}
        <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-center px-2">
          <div />
          {SCENARIO_CONFIG.map(({ key, label, badge, colBg }) => (
            <div key={key} className={`text-center text-xs font-bold px-2 py-1.5 rounded-t-lg ${badge} ${colBg}`}>
              {label}
            </div>
          ))}
        </div>

        {/* Row 1: Stock */}
        <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-center bg-gray-50 border border-gray-100 rounded-lg px-2 py-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Akcje</span>
            <ModeToggle mode={stockMode} onToggle={toggleStockMode} labelA="%" labelB="USD" />
          </div>
          {SCENARIO_CONFIG.map(({ key, accent, colBg }) => (
            <div key={key} className={`rounded-md ${colBg} p-0.5`}>
              <input
                type="number"
                step={stockMode === 'pct' ? 0.1 : 0.01}
                value={localValues[key].stock}
                onChange={(e) => handleStockChange(key, e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder={stockMode === 'pct' ? '0' : String(currentPriceUSD || '')}
                className={`w-full border-2 ${accent} rounded-md px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`}
              />
            </div>
          ))}
        </div>

        {/* Row 2: FX */}
        <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-center bg-gray-50 border border-gray-100 rounded-lg px-2 py-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">USD/PLN</span>
            <ModeToggle mode={fxMode} onToggle={toggleFxMode} labelA="%" labelB="PLN" />
          </div>
          {SCENARIO_CONFIG.map(({ key, accent, colBg }) => (
            <div key={key} className={`rounded-md ${colBg} p-0.5`}>
              <input
                type="number"
                step={fxMode === 'pct' ? 0.1 : 0.0001}
                value={localValues[key].fx}
                onChange={(e) => handleFxChange(key, e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder={fxMode === 'pct' ? '0' : String(currentFxRate || '')}
                className={`w-full border-2 ${accent} rounded-md px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`}
              />
            </div>
          ))}
        </div>

        {/* Live % preview (only in fixed mode) */}
        {(stockMode === 'fixed' || fxMode === 'fixed') && (
          <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-start px-2">
            <div />
            {SCENARIO_CONFIG.map(({ key }) => (
              <div key={key} className="text-xs text-center space-y-0.5">
                {stockMode === 'fixed' && currentPriceUSD > 0 && (() => {
                  const d = toDelta(localValues[key].stock, 'fixed', currentPriceUSD);
                  return <div className="text-gray-400">Δakcje: <span className={d >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{d >= 0 ? '+' : ''}{d.toFixed(1)}%</span></div>;
                })()}
                {fxMode === 'fixed' && currentFxRate > 0 && (() => {
                  const d = toDelta(localValues[key].fx, 'fixed', currentFxRate);
                  return <div className="text-gray-400">ΔFX: <span className={d >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{d >= 0 ? '+' : ''}{d.toFixed(1)}%</span></div>;
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      {!compact && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
          <strong className="text-gray-600">%</strong> — zmiana względem wartości dziś &nbsp;·&nbsp;{' '}
          <strong className="text-gray-600">USD / PLN</strong> — wartość docelowa bezwzględna (np. 4,12 PLN za dolara)
        </p>
      )}
    </div>
  );
}
