import { useState, useCallback } from 'react';
import { Wand2, Info } from 'lucide-react';
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

const SCENARIO_CONFIG: { key: ScenarioKey; label: string; bg: string; border: string; text: string }[] = [
  { key: 'bear', label: 'Bear', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  { key: 'base', label: 'Base', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  { key: 'bull', label: 'Bull', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
];

function initValues(s: Scenarios) {
  return {
    bear: { stock: String(parseFloat(s.bear.deltaStock.toFixed(2))), fx: String(parseFloat(s.bear.deltaFx.toFixed(4))) },
    base: { stock: String(parseFloat(s.base.deltaStock.toFixed(2))), fx: String(parseFloat(s.base.deltaFx.toFixed(4))) },
    bull: { stock: String(parseFloat(s.bull.deltaStock.toFixed(2))), fx: String(parseFloat(s.bull.deltaFx.toFixed(4))) },
  };
}

function ModeToggle({ mode, onToggle, labelA, labelB }: { mode: InputMode; onToggle: () => void; labelA: string; labelB: string }) {
  return (
    <button
      onClick={onToggle}
      className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs font-medium"
      title="Przełącz tryb wpisywania"
    >
      <span className={`px-2 py-0.5 ${mode === 'pct' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
        {labelA}
      </span>
      <span className={`px-2 py-0.5 ${mode === 'fixed' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
        {labelB}
      </span>
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

  const stockUnit = stockMode === 'pct' ? '%' : 'USD';
  const fxUnit = fxMode === 'pct' ? '%' : 'PLN';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Scenariusze</h2>
        {suggestedScenarios && (
          <button
            onClick={onApplySuggested}
            className="flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <Wand2 size={13} />
            Zastosuj z historii
          </button>
        )}
      </div>

      {volatilityStats && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-800 space-y-1">
          <div className="flex items-center gap-1.5 font-medium">
            <Info size={13} />
            Analiza historyczna (~1 rok)
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-indigo-700">
            <span>Zmienność akcji: <strong>{volatilityStats.stockSigmaAnnual.toFixed(1)}%</strong> rocznie</span>
            <span>Zmienność USD/PLN: <strong>{volatilityStats.fxSigmaAnnual.toFixed(1)}%</strong> rocznie</span>
            <span>Korelacja: <strong>{volatilityStats.correlation.toFixed(2)}</strong></span>
            <span>
              Trend akcji (info):{' '}
              <strong className={volatilityStats.stockMeanAnnual >= 0 ? 'text-green-700' : 'text-red-700'}>
                {volatilityStats.stockMeanAnnual >= 0 ? '+' : ''}{volatilityStats.stockMeanAnnual.toFixed(1)}%
              </strong>
              /rok
            </span>
          </div>
          <p className="text-indigo-500 pt-0.5">
            {volatilityStats.correlation < -0.1
              ? 'Ujemna korelacja — gdy akcje spadają, dolar zwykle się umacnia wobec PLN (częściowo amortyzuje straty).'
              : volatilityStats.correlation > 0.1
              ? 'Dodatnia korelacja — zmiany kursu USD/PLN wzmacniają efekt zmian akcji.'
              : 'Niska korelacja — ruchy akcji i kursu walutowego są w dużej mierze niezależne.'}
          </p>
          <p className="text-indigo-400 border-t border-indigo-100 pt-1">
            Bear/Bull = percentyle 5%/95% rozkładu log-normalnego (zerowy dryf). Base = 0% — trend powyżej jest zbyt niepewny by go prognozować; uwzględnij go ręcznie jeśli uważasz za stosowne.
          </p>
        </div>
      )}

      {/* Column mode toggles */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3 grid grid-cols-2 gap-3 pb-1 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Zmiana akcji:</span>
            <ModeToggle mode={stockMode} onToggle={toggleStockMode} labelA="%" labelB="USD" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Zmiana USD/PLN:</span>
            <ModeToggle mode={fxMode} onToggle={toggleFxMode} labelA="%" labelB="PLN" />
          </div>
        </div>

        {SCENARIO_CONFIG.map(({ key, label, bg, border, text }) => (
          <div key={key} className={`${bg} ${border} border rounded-lg p-3 space-y-3`}>
            <div className={`text-sm font-semibold ${text}`}>{label}</div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">
                Cena akcji ({stockUnit})
                {stockMode === 'pct' && <span className="text-gray-400"> zmiana</span>}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step={stockMode === 'pct' ? 0.1 : 0.01}
                  value={localValues[key].stock}
                  onChange={(e) => handleStockChange(key, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder={stockMode === 'pct' ? 'np. -10' : 'np. 180.00'}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500 w-7 shrink-0">{stockUnit}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">
                Kurs USD/PLN ({fxUnit})
                {fxMode === 'pct' && <span className="text-gray-400"> zmiana</span>}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step={fxMode === 'pct' ? 0.1 : 0.0001}
                  value={localValues[key].fx}
                  onChange={(e) => handleFxChange(key, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder={fxMode === 'pct' ? 'np. -5' : 'np. 4.1200'}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500 w-7 shrink-0">{fxUnit}</span>
              </div>
            </div>

            {/* Live preview of effective % when in fixed mode */}
            {(stockMode === 'fixed' || fxMode === 'fixed') && (
              <div className="text-xs text-gray-400 space-y-0.5 pt-1 border-t border-current border-opacity-10">
                {stockMode === 'fixed' && currentPriceUSD > 0 && (
                  <div>
                    Δ akcje: {(() => {
                      const d = toDelta(localValues[key].stock, 'fixed', currentPriceUSD);
                      return `${d >= 0 ? '+' : ''}${d.toFixed(2)}%`;
                    })()}
                  </div>
                )}
                {fxMode === 'fixed' && currentFxRate > 0 && (
                  <div>
                    Δ USD/PLN: {(() => {
                      const d = toDelta(localValues[key].fx, 'fixed', currentFxRate);
                      return `${d >= 0 ? '+' : ''}${d.toFixed(2)}%`;
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
        <strong>%</strong> — zmiana procentowa względem wartości dziś ·{' '}
        <strong>USD/PLN</strong> — docelowa wartość bezwzględna (np. 4.1200 PLN za dolara)
      </div>
    </div>
  );
}
