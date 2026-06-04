import { useEffect, useMemo, useRef, useState } from 'react';
import type { BondPreset, BondSettings, BenchmarkType } from '../../types/scenario';
import type { InflationData } from '../../hooks/useInflationData';
import { ComparisonInputDropdown } from './ComparisonInputDropdown';
import { BondBenchmarkSection } from '../inputs/BondBenchmarkSection';
import { EtfBenchmarkSection } from '../inputs/EtfBenchmarkSection';
import { Tooltip } from '../Tooltip';

interface ComparisonBenchmarkDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  benchmarkType: BenchmarkType;
  wibor3m: number;
  effectiveSavingsRate: number;
  horizonMonths: number;
  bondSettings: BondSettings;
  bondEffectiveRate: number;
  inflationRate: number;
  inflationData: InflationData | null;
  inflationLoading: boolean;
  nbpRefRate: number;
  etfAnnualReturnPercent: number;
  etfTicker: string;
  etfLoading: boolean;
  etfError: string | null;
  etfName: string | null;
  bondPresetId: string;
  bondPresets: BondPreset[];
  bondPresetsLoading?: boolean;
  onBenchmarkTypeChange: (value: BenchmarkType) => void;
  onWiborChange: (value: number) => void;
  onHorizonChange: (value: number) => void;
  onBondSettingsChange: (settings: BondSettings) => void;
  onBondPresetChange: (id: string, preset: BondPreset) => void;
  onInflationRateChange: (value: number) => void;
  onNbpRefRateChange: (value: number) => void;
  onEtfAnnualReturnChange: (value: number) => void;
  onEtfTickerChange: (value: string) => void;
  onFetchEtf: (ticker: string) => void;
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(value);
}

function horizonSummary(value: number): string {
  if (value <= 11) {
    return `${value} ${value === 1 ? 'miesiąc' : value < 5 ? 'miesiące' : 'miesięcy'}`;
  }
  if (value % 12 === 0) {
    const years = value / 12;
    return `${years} ${years === 1 ? 'rok' : years < 5 ? 'lata' : 'lat'}`;
  }
  return `${Math.floor(value / 12)} l. ${value % 12} mies.`;
}

function parseDecimal(raw: string): number {
  const normalized = raw.replace(',', '.').replace(/\s+/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasNumericValue(value: number): boolean {
  return value > 0 || value < 0;
}

export function ComparisonBenchmarkDropdown({
  isOpen,
  onToggle,
  benchmarkType,
  wibor3m,
  effectiveSavingsRate,
  horizonMonths,
  bondSettings,
  bondEffectiveRate,
  inflationRate,
  inflationData,
  inflationLoading,
  nbpRefRate,
  etfAnnualReturnPercent,
  etfTicker,
  etfLoading,
  etfError,
  etfName,
  bondPresetId,
  bondPresets,
  bondPresetsLoading,
  onBenchmarkTypeChange,
  onWiborChange,
  onHorizonChange,
  onBondSettingsChange,
  onBondPresetChange,
  onInflationRateChange,
  onNbpRefRateChange,
  onEtfAnnualReturnChange,
  onEtfTickerChange,
  onFetchEtf,
}: ComparisonBenchmarkDropdownProps) {
  const [savingsRateInput, setSavingsRateInput] = useState(
    () => (wibor3m > 0 ? String(wibor3m) : ''),
  );
  const previousBenchmarkTypeRef = useRef(benchmarkType);
  const selectedPreset = bondPresets.find((preset) => preset.id === bondPresetId) ?? null;
  const isComplete = benchmarkType === 'savings'
    ? wibor3m > 0 && horizonMonths > 0
    : benchmarkType === 'bonds'
      ? Boolean(selectedPreset) && horizonMonths > 0 && (
        selectedPreset?.rateType === 'fixed'
          || (selectedPreset?.rateType === 'reference' ? nbpRefRate > 0 : hasNumericValue(inflationRate))
      )
      : Boolean(etfTicker.trim()) && hasNumericValue(etfAnnualReturnPercent) && horizonMonths > 0;

  useEffect(() => {
    const switchedToSavings = previousBenchmarkTypeRef.current !== 'savings' && benchmarkType === 'savings';
    const clearedFromOutside = benchmarkType === 'savings' && wibor3m === 0 && savingsRateInput !== '';

    if (switchedToSavings || clearedFromOutside) {
      setSavingsRateInput(wibor3m > 0 ? String(wibor3m) : '');
    }

    previousBenchmarkTypeRef.current = benchmarkType;
  }, [benchmarkType, savingsRateInput, wibor3m]);

  const summary = useMemo(() => {
    if (benchmarkType === 'savings') {
      return `Konto oszczędnościowe · ${wibor3m > 0 ? `${formatPercent(wibor3m)}%` : 'brak stopy'} · ${horizonSummary(horizonMonths)}`;
    }

    if (benchmarkType === 'bonds') {
      return `${selectedPreset?.name ?? 'Obligacje skarbowe'} · ${horizonSummary(horizonMonths)}`;
    }

    return `ETF ${etfTicker || 'bez tickera'} · ${etfAnnualReturnPercent > 0 ? `${formatPercent(etfAnnualReturnPercent)}% p.a.` : 'bez stopy'} · ${horizonSummary(horizonMonths)}`;
  }, [benchmarkType, etfAnnualReturnPercent, etfTicker, horizonMonths, selectedPreset?.name, wibor3m]);

  const detail = benchmarkType === 'savings'
    ? `Skrót zapisanych danych odświeża się automatycznie. Efektywna stopa w tym horyzoncie: ${effectiveSavingsRate > 0 ? `${formatPercent(effectiveSavingsRate)}%` : '—'}.`
    : benchmarkType === 'bonds'
      ? `Wybrana alternatywa reinwestycji pozostaje widoczna również po zwinięciu dropdownu.`
      : `Ticker ETF i założony zwrot zapisują się automatycznie po każdej zmianie.`;

  const sliderMax = benchmarkType === 'savings' ? 60 : 144;
  const ticks = benchmarkType === 'savings'
    ? [
        { label: '1m', months: 1 },
        { label: '6m', months: 6 },
        { label: '1r', months: 12 },
        { label: '2l', months: 24 },
        { label: '3l', months: 36 },
        { label: '5l', months: 60 },
      ]
    : [
        { label: '1m', months: 1 },
        { label: '1r', months: 12 },
        { label: '2l', months: 24 },
        { label: '3l', months: 36 },
        { label: '5l', months: 60 },
        { label: '10l', months: 120 },
        { label: '12l', months: 144 },
      ];

  return (
    <ComparisonInputDropdown
      title="Reinwestycja i horyzont"
      summary={summary}
      detail={detail}
      isOpen={isOpen}
      isComplete={isComplete}
      onToggle={onToggle}
      onDone={onToggle}
      wrapped
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <button
            type="button"
            onClick={() => onBenchmarkTypeChange('savings')}
            className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
              benchmarkType === 'savings'
                ? 'border-accent-interactive bg-accent-interactive text-text-on-accent'
                : 'border-border bg-bg-card text-text-secondary hover:bg-bg-muted'
            }`}
          >
            Konto oszczędnościowe
          </button>
          <button
            type="button"
            onClick={() => onBenchmarkTypeChange('bonds')}
            className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
              benchmarkType === 'bonds'
                ? 'border-accent-interactive bg-accent-interactive text-text-on-accent'
                : 'border-border bg-bg-card text-text-secondary hover:bg-bg-muted'
            }`}
          >
            Obligacje skarbowe
          </button>
          <button
            type="button"
            onClick={() => onBenchmarkTypeChange('etf')}
            className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
              benchmarkType === 'etf'
                ? 'border-accent-interactive bg-accent-interactive text-text-on-accent'
                : 'border-border bg-bg-card text-text-secondary hover:bg-bg-muted'
            }`}
          >
            ETF
          </button>
        </div>

        {benchmarkType === 'savings' ? (
          <div className="space-y-1">
            <label htmlFor="comparison-savings-rate" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
              Oprocentowanie konta oszczędnościowego
              <Tooltip content="Możesz wpisać wartość z przecinkiem lub kropką. Zapisz stopę z regulaminu banku w skali roku." />
            </label>
            <input
              id="comparison-savings-rate"
              type="text"
              inputMode="decimal"
              value={savingsRateInput}
              onChange={(event) => {
                const nextValue = event.target.value;
                setSavingsRateInput(nextValue);

                if (!nextValue.trim()) {
                  onWiborChange(0);
                  return;
                }

                onWiborChange(parseDecimal(nextValue));
              }}
              placeholder="np. 5,82"
              className="w-full border border-border rounded-lg bg-bg-card px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
            />
            <p className="text-xs text-text-secondary">
              Efektywna stopa w wybranym horyzoncie: <strong className="text-text-primary">{effectiveSavingsRate > 0 ? `${formatPercent(effectiveSavingsRate)}%` : '—'}</strong>.
            </p>
          </div>
        ) : benchmarkType === 'bonds' ? (
          <BondBenchmarkSection
            selectedBondId={bondPresetId}
            bondPresets={bondPresets}
            bondPresetsLoading={bondPresetsLoading}
            bondSettings={bondSettings}
            bondEffectiveRate={bondEffectiveRate}
            horizonMonths={horizonMonths}
            inflationRate={inflationRate}
            inflationData={inflationData}
            inflationLoading={inflationLoading}
            nbpRefRate={nbpRefRate}
            onSelectPreset={onBondPresetChange}
            onBondSettingsChange={onBondSettingsChange}
            onInflationRateChange={onInflationRateChange}
            onNbpRefRateChange={onNbpRefRateChange}
          />
        ) : (
          <EtfBenchmarkSection
            etfTicker={etfTicker}
            etfLoading={etfLoading}
            etfError={etfError}
            etfName={etfName}
            etfAnnualReturnPercent={etfAnnualReturnPercent}
            onEtfAnnualReturnChange={onEtfAnnualReturnChange}
            onEtfTickerChange={onEtfTickerChange}
            onFetchEtf={onFetchEtf}
          />
        )}

        <div className="rounded-2xl border border-border bg-bg-muted/40 px-4 py-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium text-text-primary">Horyzont czasowy</p>
              <p className="text-xs text-text-secondary">Suwak jest częścią ustawień reinwestycji i zapisuje się automatycznie.</p>
            </div>
            <p className="text-sm font-semibold text-accent-primary">{horizonSummary(horizonMonths)}</p>
          </div>

          <input
            aria-label="Horyzont czasowy"
            type="range"
            min={1}
            max={sliderMax}
            step={1}
            value={horizonMonths}
            onChange={(event) => onHorizonChange(Number(event.target.value))}
            className="w-full accent-accent-primary"
          />

          <div className="relative h-5">
            {ticks.map(({ label, months }, index) => {
              const left = ((months - 1) / (sliderMax - 1)) * 100;
              const isFirst = index === 0;
              const isLast = index === ticks.length - 1;

              return (
                <span
                  key={label}
                  className="absolute text-[11px] text-text-muted"
                  style={{
                    left: `${left}%`,
                    transform: isFirst ? 'none' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </ComparisonInputDropdown>
  );
}
