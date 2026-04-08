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
}

type InputMode = 'pct' | 'fixed';

const SCENARIO_CONFIG: { key: ScenarioKey; label: string; accent: string; badge: string }[] = [
  { key: 'bear', label: 'Bear', accent: 'border-red-300',   badge: 'bg-red-50 text-red-700 border border-red-200' },
  { key: 'base', label: 'Base', accent: 'border-amber-300', badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
  { key: 'bull', label: 'Bull', accent: 'border-green-300', badge: 'bg-green-50 text-green-700 border border-green-200' },
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Scenariusze</h2>
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

      {suggestedScenarios && (
        <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-1.5">
          Scenariusze wyliczone automatycznie z ~1 roku danych historycznych. Możesz je dowolnie edytować.
        </p>
      )}

      {/* Analysis card — compact, collapsible */}
      {volatilityStats && (
        <div className="border border-indigo-100 rounded-lg overflow-hidden">
          <button
            onClick={() => setStatsOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2 bg-indigo-50 text-xs text-indigo-800 hover:bg-indigo-100 transition-colors"
          >
            <span className="flex items-center gap-2 font-medium flex-wrap">
              <span className="flex items-center gap-1.5">
                <Info size={12} />
                Analiza historyczna (~1 rok)
              </span>
              <span className="flex gap-1.5 font-normal text-indigo-600">
                <span className="bg-white rounded px-1.5 py-0.5 border border-indigo-100">
                  σ <strong>{volatilityStats.stockSigmaAnnual.toFixed(0)}%</strong>
                </span>
                <span className="bg-white rounded px-1.5 py-0.5 border border-indigo-100">
                  ρ <strong>{volatilityStats.correlation.toFixed(2)}</strong>
                </span>
                <span className={`bg-white rounded px-1.5 py-0.5 border border-indigo-100 font-semibold ${volatilityStats.stockMeanAnnual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  trend {volatilityStats.stockMeanAnnual >= 0 ? '+' : ''}{volatilityStats.stockMeanAnnual.toFixed(0)}%
                </span>
              </span>
            </span>
            {statsOpen ? <ChevronUp size={13} className="text-indigo-400 shrink-0" /> : <ChevronDown size={13} className="text-indigo-400 shrink-0" />}
          </button>

          {statsOpen && (
            <div className="px-3 py-2.5 bg-white border-t border-indigo-100 text-xs text-gray-600 space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div>
                  <strong className="text-gray-700">σ (sigma)</strong> — zmienność akcji:{' '}
                  <strong className="text-gray-800">{volatilityStats.stockSigmaAnnual.toFixed(1)}%</strong>/rok.{' '}
                  <span className="text-gray-400">Im wyższe σ, tym szersze widełki Bear–Bull.</span>
                </div>
                <div>
                  <strong className="text-gray-700">σ FX</strong> — zmienność USD/PLN:{' '}
                  <strong className="text-gray-800">{volatilityStats.fxSigmaAnnual.toFixed(1)}%</strong>/rok.
                </div>
                <div>
                  <strong className="text-gray-700">ρ (rho)</strong> — korelacja akcji z USD/PLN:{' '}
                  <strong className="text-gray-800">{volatilityStats.correlation.toFixed(2)}</strong>.{' '}
                  <span className="text-gray-400">Zakres od −1 do +1.</span>
                </div>
                <div>
                  <strong className="text-gray-700">trend</strong> — historyczna średnia stopa zwrotu akcji:{' '}
                  <strong className={volatilityStats.stockMeanAnnual >= 0 ? 'text-green-700' : 'text-red-600'}>{volatilityStats.stockMeanAnnual >= 0 ? '+' : ''}{volatilityStats.stockMeanAnnual.toFixed(1)}%</strong>/rok.{' '}
                  <span className="text-gray-400">Tylko informacyjnie — zbyt niepewny do prognoz.</span>
                </div>
              </div>
              <p className="text-gray-500 leading-relaxed border-t pt-1.5">
                {volatilityStats.correlation < -0.1
                  ? '📉 Ujemna korelacja (ρ < 0) — gdy akcje spadają, dolar zwykle się umacnia. To częściowo amortyzuje straty w PLN.'
                  : volatilityStats.correlation > 0.1
                  ? '📈 Dodatnia korelacja (ρ > 0) — wzrost/spadek akcji idzie w parze ze wzrostem/spadkiem dolara. Efekty się wzmacniają.'
                  : '➡️ Niska korelacja (ρ ≈ 0) — akcje i kurs USD/PLN zachowują się niezależnie od siebie.'}
              </p>
              <p className="text-gray-400 border-t pt-1.5 leading-relaxed">
                <strong className="text-gray-500">Bear / Bull</strong> = scenariusze p5% / p95% z modelu log-normalnego (zerowy dryf, korekta Itô).
                Oznaczają przedziały, które akcja przekracza tylko w 5% najgorszych/najlepszych przypadków w horyzoncie inwestycji.{' '}
                <strong className="text-gray-500">Base = 0%</strong> — neutralny punkt wyjścia; wpisz ręcznie jeśli masz własną prognozę.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Table layout: rows = fields, columns = scenarios */}
      <div className="space-y-2">
        {/* Column headers */}
        <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-center">
          <div />
          {SCENARIO_CONFIG.map(({ key, label, badge }) => (
            <div key={key} className={`text-center text-xs font-semibold px-2 py-1 rounded-lg ${badge}`}>
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
          {SCENARIO_CONFIG.map(({ key, accent }) => (
            <input
              key={key}
              type="number"
              step={stockMode === 'pct' ? 0.1 : 0.01}
              value={localValues[key].stock}
              onChange={(e) => handleStockChange(key, e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder={stockMode === 'pct' ? '0' : String(currentPriceUSD || '')}
              className={`w-full border-2 ${accent} rounded-md px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`}
            />
          ))}
        </div>

        {/* Row 2: FX */}
        <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-center bg-gray-50 border border-gray-100 rounded-lg px-2 py-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">USD/PLN</span>
            <ModeToggle mode={fxMode} onToggle={toggleFxMode} labelA="%" labelB="PLN" />
          </div>
          {SCENARIO_CONFIG.map(({ key, accent }) => (
            <input
              key={key}
              type="number"
              step={fxMode === 'pct' ? 0.1 : 0.0001}
              value={localValues[key].fx}
              onChange={(e) => handleFxChange(key, e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder={fxMode === 'pct' ? '0' : String(currentFxRate || '')}
              className={`w-full border-2 ${accent} rounded-md px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`}
            />
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
      <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
        <strong className="text-gray-500">%</strong> — zmiana względem wartości dziś &nbsp;·&nbsp;{' '}
        <strong className="text-gray-500">USD / PLN</strong> — wartość docelowa bezwzględna (np. 4,12 PLN za dolara)
      </p>
    </div>
  );
}
