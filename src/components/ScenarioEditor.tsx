import { useState, useCallback, useEffect, useRef } from 'react';
import { Wand2, Info, Star, Loader2, HelpCircle } from 'lucide-react';
import type { Scenarios, ScenarioKey } from '../types/scenario';
import type { VolatilityStats } from '../hooks/useHistoricalVolatility';
import { Tooltip } from './Tooltip';

interface ScenarioEditorProps {
  scenarios: Scenarios;
  onChange: (key: ScenarioKey, field: 'deltaStock' | 'deltaFx', value: number) => void;
  suggestedScenarios: Scenarios | null;
  onApplySuggested: () => void;
  onApplyModelScenarios: (s: Scenarios) => void;
  currentPriceUSD: number;
  currentFxRate: number;
  volatilityStats: VolatilityStats | null;
  /** Horizontal compact layout when rendered full-width (InputPanel collapsed) */
  compact?: boolean;
}

type InputMode = 'pct' | 'fixed';

const SCENARIO_CONFIG: {
  key: ScenarioKey;
  label: string;
  headerBg: string;
  headerText: string;
  cardBorder: string;
  cardBg: string;
  inputBorder: string;
}[] = [
  {
    key: 'bear', label: 'Bear',
    headerBg: 'bg-red-100', headerText: 'text-red-700',
    cardBorder: 'border-red-200', cardBg: 'bg-red-50/30',
    inputBorder: 'border-red-300 focus:ring-red-400',
  },
  {
    key: 'base', label: 'Base',
    headerBg: 'bg-amber-100', headerText: 'text-amber-700',
    cardBorder: 'border-amber-200', cardBg: 'bg-amber-50/30',
    inputBorder: 'border-amber-300 focus:ring-amber-400',
  },
  {
    key: 'bull', label: 'Bull',
    headerBg: 'bg-green-100', headerText: 'text-green-700',
    cardBorder: 'border-green-200', cardBg: 'bg-green-50/30',
    inputBorder: 'border-green-300 focus:ring-green-400',
  },
];

function initValues(s: Scenarios) {
  const fmt = (n: number) => String(parseFloat(n.toFixed(2)));
  return {
    bear: { stock: fmt(s.bear.deltaStock), fx: fmt(s.bear.deltaFx) },
    base: { stock: fmt(s.base.deltaStock), fx: fmt(s.base.deltaFx) },
    bull: { stock: fmt(s.bull.deltaStock), fx: fmt(s.bull.deltaFx) },
  };
}

function ModeToggle({ mode, onToggle, labelA, labelB, disabled }: { mode: InputMode; onToggle: () => void; labelA: string; labelB: string; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex w-full rounded border border-gray-200 overflow-hidden text-[11px] font-medium ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      title={disabled ? 'Wpisz ticker, aby przełączyć tryb' : 'Przełącz tryb wpisywania'}
    >
      <span className={`flex-1 text-center py-0.5 transition-colors ${mode === 'pct' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>{labelA}</span>
      <span className={`flex-1 text-center py-0.5 transition-colors ${mode === 'fixed' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>{labelB}</span>
    </button>
  );
}

export function ScenarioEditor({
  scenarios,
  onChange,
  suggestedScenarios,
  onApplySuggested,
  onApplyModelScenarios,
  currentPriceUSD,
  currentFxRate,
  volatilityStats,
  compact,
}: ScenarioEditorProps) {
  const [stockMode, setStockMode] = useState<InputMode>('pct');
  const [fxMode, setFxMode] = useState<InputMode>('pct');
  const [localValues, setLocalValues] = useState(() => initValues(scenarios));
  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  // Sync localValues when scenarios change externally (model switch, apply suggested)
  // without remounting the component (preserves stockMode/fxMode/activeModelId).
  // Must convert % deltas to the current display mode (USD/PLN) when in fixed mode.
  const prevScenariosRef = useRef(scenarios);
  useEffect(() => {
    if (scenarios !== prevScenariosRef.current) {
      prevScenariosRef.current = scenarios;
      const keys: ScenarioKey[] = ['bear', 'base', 'bull'];
      const updated = {} as Record<ScenarioKey, { stock: string; fx: string }>;
      for (const key of keys) {
        const pctStock = scenarios[key].deltaStock;
        const pctFx = scenarios[key].deltaFx;
        updated[key] = {
          stock: stockMode === 'fixed' && currentPriceUSD > 0
            ? (currentPriceUSD * (1 + pctStock / 100)).toFixed(2)
            : String(parseFloat(pctStock.toFixed(2))),
          fx: fxMode === 'fixed' && currentFxRate > 0
            ? (currentFxRate * (1 + pctFx / 100)).toFixed(4)
            : String(parseFloat(pctFx.toFixed(2))),
        };
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalValues(updated);
    }
  }, [scenarios, stockMode, fxMode, currentPriceUSD, currentFxRate]);

  const toDelta = useCallback((raw: string, mode: InputMode, currentVal: number): number => {
    const n = parseFloat(raw);
    if (isNaN(n)) return 0;
    if (mode === 'pct') return Math.max(-100, n);
    if (currentVal <= 0) return 0;
    return Math.max(-100, (n / currentVal - 1) * 100);
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
    if (currentPriceUSD <= 0) return;
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
    if (currentFxRate <= 0) return;
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

  // Compact mode: horizontal inline layout
  if (compact) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-800">Scenariusze</h2>
            {volatilityStats?.modelsLoading && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Loader2 size={12} className="animate-spin" />
              </span>
            )}
          </div>
          {suggestedScenarios && (
            <button onClick={onApplySuggested} className="flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors">
              <Wand2 size={13} />
              Przywróć
            </button>
          )}
        </div>
        {/* Compact table: same as before */}
        {currentPriceUSD <= 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-3">Pobierz dane akcji, aby zobaczyć scenariusze.</p>
        ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-center px-1">
            <div />
            {SCENARIO_CONFIG.map(({ key, label, headerBg, headerText }) => (
              <div key={key} className={`text-center text-xs font-bold px-2 py-1 rounded ${headerBg} ${headerText}`}>{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-center px-1">
            <span className="text-xs font-medium text-gray-600">Akcje ({stockUnit})</span>
            {SCENARIO_CONFIG.map(({ key, inputBorder }) => (
              <input key={key} type="text" inputMode="decimal" value={localValues[key].stock}
                onChange={(e) => handleStockChange(key, e.target.value)} onFocus={(e) => e.target.select()}
                className={`w-full border ${inputBorder} rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 bg-white`} />
            ))}
          </div>
          <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-center px-1">
            <span className="text-xs font-medium text-gray-600">USD/PLN ({fxUnit})</span>
            {SCENARIO_CONFIG.map(({ key, inputBorder }) => (
              <input key={key} type="text" inputMode="decimal" value={localValues[key].fx}
                onChange={(e) => handleFxChange(key, e.target.value)} onFocus={(e) => e.target.select()}
                className={`w-full border ${inputBorder} rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 bg-white`} />
            ))}
          </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col h-full">

      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-800">Scenariusze</h2>
          <Tooltip content={
            <span>
              <strong>%</strong> — zmiana procentowa względem obecnej ceny<br/>
              <strong>USD / PLN</strong> — docelowa cena lub kurs
            </span>
          }>
            <HelpCircle size={14} className="text-gray-300 cursor-help hover:text-gray-500 transition-colors" />
          </Tooltip>
          {volatilityStats?.modelsLoading && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin" />
              przeliczam…
            </span>
          )}
        </div>
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

      {/* Model tabs */}
      {volatilityStats?.models && volatilityStats.models.models.length > 1 && (() => {
        const { models, recommended, scoring } = volatilityStats.models;
        const availableModels = models.filter(m => m.confidence > 0);
        if (availableModels.length < 2) return null;
        const currentId = activeModelId ?? recommended.id;
        return (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {availableModels.map(m => {
              const isRecommended = m.id === recommended.id;
              const isActive = m.id === currentId;
              const coverage = scoring && m.coverageScore != null
                ? `${Math.round(m.coverageScore * 100)}%`
                : null;
              return (
                <Tooltip
                  key={m.id}
                  side="bottom"
                  width="w-64"
                  content={
                    <span>
                      <strong>{m.name}</strong>
                      {isRecommended && <span className="text-amber-300"> (rekomendowany)</span>}
                      <br />
                      {m.description}
                      {coverage && (
                        <>
                          <br />
                          <span className="text-gray-300">Trafność: {coverage} — jak dobrze model przewiduje dane historyczne (cel: 90%).</span>
                        </>
                      )}
                      {isRecommended && (
                        <>
                          <br />
                          <span className="text-amber-200">Wybrany automatycznie jako najlepiej dopasowany do danych.</span>
                        </>
                      )}
                    </span>
                  }
                >
                  <button
                    onClick={() => {
                      setActiveModelId(m.id);
                      const s = volatilityStats.modelScenarios[m.id];
                      if (s) onApplyModelScenarios(s);
                    }}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-700'
                    }`}
                  >
                    {isRecommended && <Star size={10} className={isActive ? 'text-amber-300' : 'text-amber-400'} />}
                    {m.name}
                    {coverage && <span className={`text-[10px] ${isActive ? 'text-indigo-200' : 'text-gray-400'}`}>{coverage}</span>}
                  </button>
                </Tooltip>
              );
            })}
            <Tooltip
              side="bottom"
              width="w-72"
              content={
                <span>
                  Aplikacja uruchamia 3 modele predykcyjne i automatycznie wybiera najlepszy:<br /><br />
                  <strong>Bootstrap</strong> — losuje bloki historycznych zwrotów, zero założeń<br />
                  <strong>GARCH</strong> — modeluje zmienną zmienność (vol clustering)<br />
                  <strong>HMM</strong> — rozpoznaje fazy rynku (bull/bear)<br /><br />
                  {'\u2605'} = model z najlepszym dopasowaniem do danych (coverage najbliższy 90%)
                </span>
              }
            >
              <HelpCircle size={13} className="text-gray-300 cursor-help hover:text-gray-500 transition-colors" />
            </Tooltip>
          </div>
        );
      })()}

      {currentPriceUSD <= 0 ? (
        <div className="flex-1 flex items-center justify-center text-center py-8">
          <p className="text-sm text-gray-400 italic">Pobierz dane akcji, aby zobaczyć scenariusze i prognozy modeli.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Header row */}
          <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-center">
            <div />
            {SCENARIO_CONFIG.map(({ key, label, headerBg, headerText }) => (
              <div key={key} className={`text-center text-xs font-bold px-2 py-1.5 rounded ${headerBg} ${headerText}`}>{label}</div>
            ))}
          </div>

          {/* Stock row */}
          <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-start">
            <div className="flex flex-col gap-1 pt-0.5">
              <span className="text-xs font-medium text-gray-600">Akcje ({stockUnit})</span>
              <ModeToggle mode={stockMode} onToggle={toggleStockMode} labelA="%" labelB="USD" disabled={currentPriceUSD <= 0} />
            </div>
            {SCENARIO_CONFIG.map(({ key, inputBorder }) => {
              const delta = toDelta(localValues[key].stock, stockMode, currentPriceUSD);
              return (
                <div key={key} className="flex flex-col items-center gap-0.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={localValues[key].stock}
                    onChange={(e) => handleStockChange(key, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder={stockMode === 'pct' ? '0' : String(currentPriceUSD || '')}
                    className={`w-full border ${inputBorder} rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 bg-white`}
                  />
                  {stockMode === 'fixed' && currentPriceUSD > 0 && (
                    <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                      delta >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                    }`}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* FX row */}
          <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-start">
            <div className="flex flex-col gap-1 pt-0.5">
              <span className="text-xs font-medium text-gray-600">USD/PLN ({fxUnit})</span>
              <ModeToggle mode={fxMode} onToggle={toggleFxMode} labelA="%" labelB="PLN" disabled={currentFxRate <= 0} />
            </div>
            {SCENARIO_CONFIG.map(({ key, inputBorder }) => {
              const delta = toDelta(localValues[key].fx, fxMode, currentFxRate);
              return (
                <div key={key} className="flex flex-col items-center gap-0.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={localValues[key].fx}
                    onChange={(e) => handleFxChange(key, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder={fxMode === 'pct' ? '0' : String(currentFxRate || '')}
                    className={`w-full border ${inputBorder} rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 bg-white`}
                  />
                  {fxMode === 'fixed' && currentFxRate > 0 && (
                    <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                      delta >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                    }`}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Analysis — always visible */}
      {volatilityStats && (
        <div className="flex-1 min-h-0 flex flex-col border border-indigo-100 rounded-lg overflow-hidden mt-2">
          <div className="w-full flex items-center px-3 py-1.5 bg-indigo-50/60 text-xs text-indigo-800 shrink-0">
            <span className="flex items-center gap-2 flex-wrap">
              <Info size={11} className="text-indigo-400 shrink-0" />
              <span className="font-medium">Analiza historyczna</span>
              {volatilityStats.regime && (
                <Tooltip content={`Prawdopodobieństwo: ${Math.round(volatilityStats.regime.posteriorProbability * 100)}%`}>
                  <span className={`rounded px-1.5 py-0.5 border text-[11px] font-semibold cursor-help ${
                    volatilityStats.regime.currentRegimeLabel === 'bull'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {volatilityStats.regime.currentRegimeLabel === 'bull' ? 'Faza wzrostowa' : 'Faza spadkowa'}
                  </span>
                </Tooltip>
              )}
              <span className="text-indigo-500">
                {'\u03c3'} {volatilityStats.stockSigmaAnnual.toFixed(0)}%/r
              </span>
              <span className={volatilityStats.stockMeanAnnual >= 0 ? 'text-green-600' : 'text-red-500'}>
                {volatilityStats.stockMeanAnnual >= 0 ? '+' : ''}{volatilityStats.stockMeanAnnual.toFixed(0)}%/r
              </span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 bg-white border-t border-indigo-100 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zmienność akcji</div>
                  <div className="text-2xl font-bold text-gray-900 leading-none">{volatilityStats.stockSigmaAnnual.toFixed(1)}%<span className="text-xs font-normal text-gray-400 ml-0.5">/rok</span></div>
                  <div className="text-xs text-gray-500 leading-snug">Im wyższa, tym większy rozrzut scenariuszy.</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zmienność USD/PLN</div>
                  <div className="text-2xl font-bold text-gray-900 leading-none">{volatilityStats.fxSigmaAnnual.toFixed(1)}%<span className="text-xs font-normal text-gray-400 ml-0.5">/rok</span></div>
                  <div className="text-xs text-gray-500 leading-snug">Dodatkowe źródło ryzyka walutowego.</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Korelacja z USD</div>
                  <div className={`text-2xl font-bold leading-none ${Math.abs(volatilityStats.correlation) > 0.1 ? (volatilityStats.correlation > 0 ? 'text-amber-600' : 'text-blue-600') : 'text-gray-700'}`}>
                    {volatilityStats.correlation > 0 ? '+' : ''}{volatilityStats.correlation.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 leading-snug">
                    {volatilityStats.correlation < -0.1
                      ? 'Spadek akcji → mocniejszy dolar (amortyzacja).'
                      : volatilityStats.correlation > 0.1
                      ? 'Ruchy akcji i dolara się wzmacniają.'
                      : 'Niezależne od siebie.'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trend historyczny</div>
                  <div className={`text-2xl font-bold leading-none ${volatilityStats.stockMeanAnnual >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {volatilityStats.stockMeanAnnual >= 0 ? '+' : ''}{volatilityStats.stockMeanAnnual.toFixed(1)}%<span className="text-xs font-normal text-gray-400 ml-0.5">/rok</span>
                  </div>
                  <div className="text-xs text-gray-500 leading-snug">Informacyjnie — nie prognoza.</div>
                </div>
              </div>

              {volatilityStats.regime && (
                <div className={`rounded-lg px-3 py-2.5 border text-sm ${
                  volatilityStats.regime.currentRegimeLabel === 'bull'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <span className="font-semibold">
                    {volatilityStats.regime.currentRegimeLabel === 'bull' ? 'Faza wzrostów' : 'Faza spadków'}
                    {' — '}{Math.round(volatilityStats.regime.posteriorProbability * 100)}%
                  </span>
                  <span className="opacity-70 text-xs">
                    {' · '}{'\u03c3'} {volatilityStats.regime.stateSigmasAnnual[volatilityStats.regime.currentState].toFixed(0)}%/r
                    {' · '}{volatilityStats.regime.stateMeansAnnual[volatilityStats.regime.currentState] >= 0 ? '+' : ''}{volatilityStats.regime.stateMeansAnnual[volatilityStats.regime.currentState].toFixed(0)}%/r
                    {' · '}~{volatilityStats.regime.expectedDurations[volatilityStats.regime.currentState].toFixed(0)} sesji
                  </span>
                </div>
              )}

            </div>
        </div>
      )}
    </div>
  );
}
