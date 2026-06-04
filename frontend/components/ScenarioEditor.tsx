import { useState, useCallback, useEffect, useRef } from 'react';
import { Wand2, Info, Star, Loader2, HelpCircle, TrendingDown, TrendingUp, Minus } from 'lucide-react';
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
  /** True when scenarios come from the volatility model (not user-edited) */
  isModelApplied?: boolean;
  /** Horizontal compact layout when rendered full-width (InputPanel collapsed) */
  compact?: boolean;
}

type InputMode = 'pct' | 'fixed';

const SCENARIO_CONFIG: {
  key: ScenarioKey;
  label: string;
  icon: React.ReactNode;
  headerBg: string;
  headerText: string;
  cardBorder: string;
  cardBg: string;
  inputBorder: string;
}[] = [
  {
    key: 'bear', label: 'Bear',
    icon: <TrendingDown size={14} aria-hidden="true" />,
    headerBg: 'bg-danger/10', headerText: 'text-danger',
    cardBorder: 'border-danger/30', cardBg: 'bg-danger/5',
    inputBorder: 'border-danger/30 focus:ring-danger/50',
  },
  {
    key: 'base', label: 'Base',
    icon: <Minus size={14} aria-hidden="true" />,
    headerBg: 'bg-bg-hover', headerText: 'text-text-secondary',
    cardBorder: 'border-border', cardBg: 'bg-bg-hover/30',
    inputBorder: 'border-border focus:ring-accent-primary/30',
  },
  {
    key: 'bull', label: 'Bull',
    icon: <TrendingUp size={14} aria-hidden="true" />,
    headerBg: 'bg-success/10', headerText: 'text-success',
    cardBorder: 'border-success/30', cardBg: 'bg-success/5',
    inputBorder: 'border-success/40 focus:ring-success/30',
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
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex w-full rounded border border-border overflow-hidden text-[11px] font-medium ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      aria-label={disabled ? 'Przełącz tryb wpisywania (brak danych)' : `Tryb: ${mode === 'pct' ? labelA : labelB} — kliknij, aby zmienić`}
    >
      <span className={`flex-1 text-center py-0.5 transition-colors ${mode === 'pct' ? 'bg-accent-interactive text-text-on-accent' : 'bg-bg-card text-text-muted hover:bg-bg-card'}`}>{labelA}</span>
      <span className={`flex-1 text-center py-0.5 transition-colors ${mode === 'fixed' ? 'bg-accent-interactive text-text-on-accent' : 'bg-bg-card text-text-muted hover:bg-bg-card'}`}>{labelB}</span>
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
  isModelApplied,
  compact,
}: ScenarioEditorProps) {
  const [stockMode, setStockMode] = useState<InputMode>(() => currentPriceUSD > 0 ? 'fixed' : 'pct');
  const [fxMode, setFxMode] = useState<InputMode>('pct');
  const [localValues, setLocalValues] = useState(() => {
    if (currentPriceUSD > 0) {
      const fmtFx = (n: number) => String(parseFloat(n.toFixed(2)));
      return {
        bear: { stock: (currentPriceUSD * (1 + scenarios.bear.deltaStock / 100)).toFixed(2), fx: fmtFx(scenarios.bear.deltaFx) },
        base: { stock: (currentPriceUSD * (1 + scenarios.base.deltaStock / 100)).toFixed(2), fx: fmtFx(scenarios.base.deltaFx) },
        bull: { stock: (currentPriceUSD * (1 + scenarios.bull.deltaStock / 100)).toFixed(2), fx: fmtFx(scenarios.bull.deltaFx) },
      };
    }
    return initValues(scenarios);
  });
  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  // Sync localValues when scenarios change externally (model switch, apply suggested)
  // without remounting the component (preserves stockMode/fxMode/activeModelId).
  // Must convert % deltas to the current display mode (USD/PLN) when in fixed mode.
  const prevScenariosRef = useRef(scenarios);
  // Track whether any scenario input is currently focused — skip external syncs while editing
  const anyInputFocused = useRef(false);
  useEffect(() => {
    if (scenarios !== prevScenariosRef.current) {
      prevScenariosRef.current = scenarios;
      if (anyInputFocused.current) return; // user is typing — don't overwrite their input
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

  const handleStockBlur = useCallback((key: ScenarioKey) => {
    anyInputFocused.current = false;
    setLocalValues(prev => {
      const n = parseFloat(prev[key].stock);
      const formatted = isNaN(n)
        ? (stockMode === 'fixed' && currentPriceUSD > 0 ? currentPriceUSD.toFixed(2) : '0')
        : stockMode === 'fixed' ? n.toFixed(2) : String(parseFloat(n.toFixed(2)));
      return { ...prev, [key]: { ...prev[key], stock: formatted } };
    });
  }, [stockMode, currentPriceUSD]);

  const handleFxBlur = useCallback((key: ScenarioKey) => {
    anyInputFocused.current = false;
    setLocalValues(prev => {
      const n = parseFloat(prev[key].fx);
      const formatted = isNaN(n)
        ? (fxMode === 'fixed' && currentFxRate > 0 ? currentFxRate.toFixed(4) : '0')
        : fxMode === 'fixed' ? n.toFixed(4) : String(parseFloat(n.toFixed(2)));
      return { ...prev, [key]: { ...prev[key], fx: formatted } };
    });
  }, [fxMode, currentFxRate]);

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
      <div className="bg-bg-card rounded-xl border border-border shadow-sm px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-text-primary">Scenariusze</h2>
            {volatilityStats?.modelsLoading && (
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              </span>
            )}
          </div>
          {suggestedScenarios && (
            <button type="button" onClick={onApplySuggested} className="flex items-center gap-1.5 text-xs bg-accent-primary/5 text-accent-primary border border-accent-primary/30 px-3 py-1.5 rounded-lg hover:bg-accent-primary/10 transition-colors">
              <Wand2 size={12} aria-hidden="true" />
              Przywróć
            </button>
          )}
        </div>
        {/* Compact table: same as before */}
        {currentPriceUSD <= 0 ? (
          <p className="text-sm text-text-muted italic text-center py-3">Pobierz dane akcji, aby zobaczyć scenariusze.</p>
        ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-center px-1">
            <div />
            {SCENARIO_CONFIG.map(({ key, label, icon, headerBg, headerText }) => (
              <div key={key} className={`text-center text-xs font-bold px-2 py-1 rounded flex items-center justify-center gap-1 ${headerBg} ${headerText}`}>{icon}{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-center px-1">
            <span className="text-xs font-medium text-text-secondary">Akcje ({stockUnit})</span>
            {SCENARIO_CONFIG.map(({ key, label, inputBorder }) => (
              <input key={key} type="text" inputMode="decimal" value={localValues[key].stock}
                onChange={(e) => handleStockChange(key, e.target.value)}
                onFocus={(e) => { anyInputFocused.current = true; e.target.select(); }}
                onBlur={() => handleStockBlur(key)}
                aria-label={`${label} — zmiana akcji (${stockUnit})`}
                className={`w-full border ${inputBorder} rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 bg-bg-card`} />
            ))}
          </div>
          <div className="grid grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-center px-1">
            <span className="text-xs font-medium text-text-secondary">USD/PLN ({fxUnit})</span>
            {SCENARIO_CONFIG.map(({ key, label, inputBorder }) => (
              <input key={key} type="text" inputMode="decimal" value={localValues[key].fx}
                onChange={(e) => handleFxChange(key, e.target.value)}
                onFocus={(e) => { anyInputFocused.current = true; e.target.select(); }}
                onBlur={() => handleFxBlur(key)}
                aria-label={`${label} — zmiana kursu (${fxUnit})`}
                className={`w-full border ${inputBorder} rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 bg-bg-card`} />
            ))}
          </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 flex flex-col h-full">

      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-text-primary">Scenariusze</h2>
          <Tooltip content={
            <span>
              <strong>%</strong> — zmiana procentowa względem obecnej ceny<br/>
              <strong>USD / PLN</strong> — docelowa cena lub kurs
            </span>
          }>
            <HelpCircle size={16} aria-hidden="true" className="text-text-muted cursor-help hover:text-text-primary transition-colors" />
          </Tooltip>
          {volatilityStats?.modelsLoading && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              przeliczam…
            </span>
          )}
        </div>
        {suggestedScenarios && (
          <button
            type="button"
            onClick={onApplySuggested}
            className="flex items-center gap-1.5 text-xs bg-accent-primary/5 text-accent-primary border border-accent-primary/30 px-3 py-1.5 rounded-lg hover:bg-accent-primary/10 transition-colors"
          >
            <Wand2 size={12} aria-hidden="true" />
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
                      {isRecommended && <span className="text-accent-secondary"> (rekomendowany)</span>}
                      <br />
                      {m.description}
                      {coverage && (
                        <>
                          <br />
                          <span className="text-text-secondary">Trafność: {coverage} — jak dobrze model przewiduje dane historyczne (cel: 90%).</span>
                        </>
                      )}
                      {isRecommended && (
                        <>
                          <br />
                          <span className="text-accent-secondary">Najlepszy model dla wybranego horyzontu inwestycyjnego.</span>
                        </>
                      )}
                    </span>
                  }
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModelId(m.id);
                      const s = volatilityStats.modelScenarios[m.id];
                      if (s) onApplyModelScenarios(s);
                    }}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      isActive
                        ? 'bg-accent-interactive text-text-on-accent border-accent-interactive'
                        : 'bg-bg-card text-text-secondary border-border hover:border-accent-primary/50 hover:text-accent-primary'
                    }`}
                  >
                    {isRecommended && <Star size={12} className={isActive ? 'text-white/80' : 'text-accent-primary'} />}
                    {m.name}
                    {coverage && <span className={`text-[10px] ${isActive ? 'text-white/70' : 'text-text-muted'}`}>{coverage}</span>}
                  </button>
                </Tooltip>
              );
            })}
            <Tooltip
              side="bottom"
              width="w-80"
              content={
                <span>
                  <strong>Jak działa prognoza?</strong><br /><br />
                  <strong>1. Rozpoznanie nastroju rynku</strong><br />
                  Algorytm analizuje ostatnie ~2 lata kursów i ocenia, czy akcja jest teraz w trendzie wzrostowym czy spadkowym. To wpływa na założenia w kolejnym kroku.<br /><br />
                  <strong>2. Budowa scenariuszy</strong><br />
                  Do 6 miesięcy → algorytm losuje fragmenty prawdziwej historii kursu i skleja je w możliwe ścieżki cenowe.<br />
                  Powyżej 6 miesięcy → wzór matematyczny symuluje ruch kursu z uwzględnieniem historycznej zmienności i długoterminowego wzrostu rynku (~8%/rok). Gdy akcja jest w trendzie wzrostowym, założenie jest wyższe (~12%/rok); w spadkowym — niższe (~3%/rok).<br /><br />
                  <strong>3. Pamiętaj</strong><br />
                  Model nie zna wyników finansowych spółki, decyzji banków centralnych ani bieżących nastrojów. Każdy wynik to <em>scenariusz</em>, nie przepowiednia.<br /><br />
                  {'\u2605'} = zalecany algorytm dla wybranego horyzontu
                </span>
              }
            >
              <HelpCircle size={12} aria-hidden="true" className="text-text-muted cursor-help hover:text-text-primary transition-colors" />
            </Tooltip>
          </div>
        );
      })()}

      {/* Global mode toggles */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Akcje</span>
          <div className="w-20">
            <ModeToggle mode={stockMode} onToggle={toggleStockMode} labelA="%" labelB="USD" disabled={currentPriceUSD <= 0} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">USD/PLN</span>
          <div className="w-20">
            <ModeToggle mode={fxMode} onToggle={toggleFxMode} labelA="%" labelB="PLN" disabled={currentFxRate <= 0} />
          </div>
        </div>
      </div>

      {currentPriceUSD <= 0 ? (
        <div className="flex-1 flex items-center justify-center text-center py-8">
          <p className="text-sm text-text-muted italic">Pobierz dane akcji, aby zobaczyć scenariusze i prognozy modeli.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Base — full-width prominent card */}
          {(() => {
            const cfg = SCENARIO_CONFIG.find(c => c.key === 'base')!;
            const { key, label, icon, headerBg, headerText, cardBorder, cardBg, inputBorder } = cfg;
            const stockDelta = toDelta(localValues[key].stock, stockMode, currentPriceUSD);
            const fxDelta = toDelta(localValues[key].fx, fxMode, currentFxRate);
            const impliedPrice = stockMode === 'fixed'
              ? parseFloat(localValues[key].stock || '0').toFixed(2)
              : (currentPriceUSD * (1 + stockDelta / 100)).toFixed(2);
            const contextNote = isModelApplied
              ? 'Wyliczono z historii'
              : stockDelta === 0 && fxDelta === 0
              ? 'Brak założenia — cena bez zmian'
              : 'Własne założenie';
            return (
              <div key={key} className={`${cardBg} ${cardBorder} border rounded-xl p-3 space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded ${headerBg} ${headerText}`}>
                    {icon}{label}
                  </div>
                  <span className="text-xs text-text-muted">
                    {contextNote}{' · →'}${impliedPrice}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-text-secondary">Akcje ({stockUnit})</span>
                    <input
                      type="text" inputMode="decimal"
                      value={localValues[key].stock}
                      onChange={(e) => handleStockChange(key, e.target.value)}
                      onFocus={(e) => { anyInputFocused.current = true; e.target.select(); }}
                      onBlur={() => handleStockBlur(key)}
                      placeholder={stockMode === 'pct' ? '0' : String(currentPriceUSD || '')}
                      className={`w-full border ${inputBorder} rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 bg-bg-card`}
                    />
                    {stockMode === 'fixed' && (
                      <p className={`text-[10px] text-center ${stockDelta >= 0 ? 'text-success' : 'text-danger'}`}>
                        {stockDelta >= 0 ? '+' : ''}{stockDelta.toFixed(1)}%
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-text-secondary flex items-center gap-1">
                      USD/PLN ({fxUnit})
                      {volatilityStats && Math.abs(volatilityStats.correlation) > 0.05 && (
                        <Tooltip width="w-64" content={
                          volatilityStats.correlation < 0
                            ? 'Ujemna korelacja akcje↔USD: w scenariuszu wzrostowym PLN się umacnia, w spadkowym USD rośnie jako „safe haven".'
                            : 'Dodatnia korelacja akcje↔USD: wzrosty akcji idą w parze ze wzrostem dolara.'
                        }>
                          <HelpCircle size={10} className="text-text-muted cursor-help" aria-hidden="true" />
                        </Tooltip>
                      )}
                    </span>
                    <input
                      type="text" inputMode="decimal"
                      value={localValues[key].fx}
                      onChange={(e) => handleFxChange(key, e.target.value)}
                      onFocus={(e) => { anyInputFocused.current = true; e.target.select(); }}
                      onBlur={() => handleFxBlur(key)}
                      placeholder={fxMode === 'pct' ? '0' : String(currentFxRate || '')}
                      className={`w-full border ${inputBorder} rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 bg-bg-card`}
                    />
                    {fxMode === 'fixed' && currentFxRate > 0 && (
                      <p className={`text-[10px] text-center ${fxDelta >= 0 ? 'text-success' : 'text-danger'}`}>
                        {fxDelta >= 0 ? '+' : ''}{fxDelta.toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Bear + Bull — sensitivity row */}
          <div className="grid grid-cols-2 gap-2">
            {SCENARIO_CONFIG.filter(cfg => cfg.key !== 'base').map(({ key, label, icon, headerBg, headerText, cardBorder, cardBg, inputBorder }) => {
              const stockDelta = toDelta(localValues[key].stock, stockMode, currentPriceUSD);
              const fxDelta = toDelta(localValues[key].fx, fxMode, currentFxRate);
              return (
                <div key={key} className={`${cardBg} ${cardBorder} border rounded-xl p-3 space-y-3`}>
                  <div className={`flex items-center justify-center gap-1 text-xs font-bold px-2 py-1 rounded ${headerBg} ${headerText}`}>
                    {icon}{label}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-text-secondary">Akcje ({stockUnit})</span>
                    <input
                      type="text" inputMode="decimal"
                      value={localValues[key].stock}
                      onChange={(e) => handleStockChange(key, e.target.value)}
                      onFocus={(e) => { anyInputFocused.current = true; e.target.select(); }}
                      onBlur={() => handleStockBlur(key)}
                      placeholder={stockMode === 'pct' ? '0' : String(currentPriceUSD || '')}
                      className={`w-full border ${inputBorder} rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 bg-bg-card`}
                    />
                    {stockMode === 'fixed' && (
                      <p className={`text-[10px] text-center ${stockDelta >= 0 ? 'text-success' : 'text-danger'}`}>
                        {stockDelta >= 0 ? '+' : ''}{stockDelta.toFixed(1)}%
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-text-secondary">USD/PLN ({fxUnit})</span>
                    <input
                      type="text" inputMode="decimal"
                      value={localValues[key].fx}
                      onChange={(e) => handleFxChange(key, e.target.value)}
                      onFocus={(e) => { anyInputFocused.current = true; e.target.select(); }}
                      onBlur={() => handleFxBlur(key)}
                      placeholder={fxMode === 'pct' ? '0' : String(currentFxRate || '')}
                      className={`w-full border ${inputBorder} rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 bg-bg-card`}
                    />
                    {fxMode === 'fixed' && currentFxRate > 0 && (
                      <p className={`text-[10px] text-center ${fxDelta >= 0 ? 'text-success' : 'text-danger'}`}>
                        {fxDelta >= 0 ? '+' : ''}{fxDelta.toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Analysis — always visible */}
      {volatilityStats && (
        <div className="flex-1 min-h-0 flex flex-col border border-accent-primary/20 rounded-lg overflow-hidden mt-4">
          <div className="w-full flex items-center gap-2 px-3 py-2 bg-accent-primary/5 text-xs font-semibold text-accent-primary shrink-0">
            <Info size={12} aria-hidden="true" className="shrink-0" />
            Analiza historyczna
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 bg-bg-hover border-t border-accent-primary/20 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-bg-card rounded-lg p-3 space-y-1">
                  <div className="text-xs font-semibold text-text-muted uppercase tracking-wide">Zmienność akcji</div>
                  <div className="text-2xl font-bold text-text-primary leading-none">{volatilityStats.stockSigmaAnnual.toFixed(1)}%<span className="text-xs font-normal text-text-muted ml-0.5">/rok</span></div>
                  <div className="text-xs text-text-muted leading-snug">Im wyższa, tym większy rozrzut scenariuszy.</div>
                </div>
                <div className="bg-bg-card rounded-lg p-3 space-y-1">
                  <div className="text-xs font-semibold text-text-muted uppercase tracking-wide">Zmienność USD/PLN</div>
                  <div className="text-2xl font-bold text-text-primary leading-none">{volatilityStats.fxSigmaAnnual.toFixed(1)}%<span className="text-xs font-normal text-text-muted ml-0.5">/rok</span></div>
                  <div className="text-xs text-text-muted leading-snug">Dodatkowe źródło ryzyka walutowego.</div>
                </div>
                {Math.abs(volatilityStats.correlation) > 0.1 && (
                <div className="bg-bg-card rounded-lg p-3 space-y-1">
                  <div className="text-xs font-semibold text-text-muted uppercase tracking-wide">Korelacja z USD</div>
                  <div className={`text-2xl font-bold leading-none ${volatilityStats.correlation > 0 ? 'text-danger' : 'text-accent-primary'}`}>
                    {volatilityStats.correlation > 0 ? '+' : ''}{volatilityStats.correlation.toFixed(2)}
                  </div>
                  <div className="text-xs text-text-muted leading-snug">
                    {volatilityStats.correlation < -0.1
                      ? 'Spadek akcji → mocniejszy dolar (amortyzacja).'
                      : 'Ruchy akcji i dolara się wzmacniają.'}
                  </div>
                </div>
                )}
                <div className="bg-bg-card rounded-lg p-3 space-y-1">
                  <div className="text-xs font-semibold text-text-muted uppercase tracking-wide">Trend historyczny</div>
                  <div className={`text-2xl font-bold leading-none ${volatilityStats.stockMeanAnnual >= 0 ? 'text-success' : 'text-danger'}`}>
                    {volatilityStats.stockMeanAnnual >= 0 ? '+' : ''}{volatilityStats.stockMeanAnnual.toFixed(1)}%<span className="text-xs font-normal text-text-muted ml-0.5">/rok</span>
                  </div>
                  <div className="text-xs text-text-muted leading-snug">Informacyjnie — nie prognoza.</div>
                </div>
              </div>

              {volatilityStats.regime && (
                <div className={`rounded-lg px-3 py-2.5 border text-sm ${
                  volatilityStats.regime.currentRegimeLabel === 'bull'
                    ? 'bg-success/5 border-success/30 text-success'
                    : 'bg-danger/5 border-danger/30 text-danger'
                }`}>
                  <span className="font-semibold">
                    {volatilityStats.regime.currentRegimeLabel === 'bull' ? 'Trend wzrostowy' : 'Trend spadkowy'}
                    {' — '}{Math.round(volatilityStats.regime.posteriorProbability * 100)}%
                  </span>
                  <span className="opacity-70 text-xs">
                    {' · '}{'\u03c3'} {volatilityStats.regime.stateSigmasAnnual[volatilityStats.regime.currentState].toFixed(0)}%/r
                    {' · '}{volatilityStats.regime.stateMeansAnnual[volatilityStats.regime.currentState] >= 0 ? '+' : ''}{volatilityStats.regime.stateMeansAnnual[volatilityStats.regime.currentState].toFixed(0)}%/r
                    {' · '}~{volatilityStats.regime.expectedDurations[volatilityStats.regime.currentState].toFixed(0)} sesji
                  </span>
                  <div className="text-xs opacity-60 mt-1">
                    Wykryty trend wpływa na założenia prognozy: wzrostowy → ~12%/rok, spadkowy → ~3%/rok.
                  </div>
                </div>
              )}

            </div>
        </div>
      )}
    </div>
  );
}
