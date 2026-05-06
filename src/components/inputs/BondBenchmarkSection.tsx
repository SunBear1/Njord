import { useEffect, useMemo } from 'react';
import { Loader2, Info, ExternalLink } from 'lucide-react';
import type { BondPreset, BondSettings } from '../../types/scenario';
import type { InflationData } from '../../hooks/useInflationData';
import { Tooltip } from '../Tooltip';

interface BondBenchmarkSectionProps {
  selectedBondId: string;
  bondPresets: BondPreset[];
  bondPresetsLoading?: boolean;
  bondSettings: BondSettings;
  bondEffectiveRate: number;
  horizonMonths: number;
  inflationRate: number;
  inflationData: InflationData | null;
  inflationLoading: boolean;
  nbpRefRate: number;
  onSelectPreset: (id: string, preset: BondPreset) => void;
  onBondSettingsChange: (settings: BondSettings) => void;
  onInflationRateChange: (value: number) => void;
  onNbpRefRateChange: (value: number) => void;
}

function nextPenalty(preset: BondPreset, horizonMonths: number): number {
  const earlyExit = horizonMonths < preset.maturityMonths;
  return earlyExit && preset.earlyRedemptionAllowed ? preset.earlyRedemptionPenalty : 0;
}

export function BondBenchmarkSection({
  selectedBondId,
  bondPresets,
  bondPresetsLoading,
  bondSettings,
  bondEffectiveRate,
  horizonMonths,
  inflationRate,
  inflationData,
  inflationLoading,
  nbpRefRate,
  onSelectPreset,
  onBondSettingsChange,
  onInflationRateChange,
  onNbpRefRateChange,
}: BondBenchmarkSectionProps) {
  const sortedPresets = useMemo(
    () => [...bondPresets].sort((left, right) => left.maturityMonths - right.maturityMonths),
    [bondPresets],
  );

  const preset = sortedPresets.find((item) => item.id === selectedBondId) ?? sortedPresets[0] ?? null;
  const earlyExit = preset ? horizonMonths < preset.maturityMonths : false;

  useEffect(() => {
    if (!preset) return;

    if (preset.id !== selectedBondId) {
      onSelectPreset(preset.id, preset);
      return;
    }

    const penalty = nextPenalty(preset, horizonMonths);
    const shouldSync =
      bondSettings.firstYearRate !== preset.firstYearRate ||
      bondSettings.rateType !== preset.rateType ||
      bondSettings.margin !== preset.margin ||
      bondSettings.couponFrequency !== preset.couponFrequency ||
      bondSettings.maturityMonths !== preset.maturityMonths ||
      bondSettings.penalty !== penalty;

    if (!shouldSync) return;

    onBondSettingsChange({
      firstYearRate: preset.firstYearRate,
      rateType: preset.rateType,
      margin: preset.margin,
      couponFrequency: preset.couponFrequency,
      maturityMonths: preset.maturityMonths,
      penalty,
    });
  }, [bondSettings, horizonMonths, onBondSettingsChange, onSelectPreset, preset, selectedBondId]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="bond-type" className="text-sm font-medium text-text-secondary">
          Typ obligacji
        </label>
        <select
          id="bond-type"
          name="bondType"
          value={preset?.id ?? ''}
          onChange={(event) => {
            const nextPreset = sortedPresets.find((item) => item.id === event.target.value);
            if (nextPreset) {
              onSelectPreset(nextPreset.id, nextPreset);
            }
          }}
          className="w-full border border-border rounded-lg bg-bg-card px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
        >
          {bondPresetsLoading ? (
            <option disabled>Ładowanie…</option>
          ) : (
            sortedPresets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {item.description}{item.isFamily ? ' (800+)' : ''}
              </option>
            ))
          )}
        </select>
      </div>

      {preset && (
        <div className="space-y-3">
          {preset.isFamily && (
            <div className="flex items-start gap-1.5 bg-accent-primary/5 border border-accent-primary/30 text-accent-primary text-xs rounded-lg p-2.5">
              <Info size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              Obligacje rodzinne są dostępne tylko dla beneficjentów programu 800+.
            </div>
          )}

          <div className="bg-bg-muted/40 border border-border rounded-xl p-3 space-y-2 text-xs">
            {bondSettings.firstYearRate > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-text-secondary">Oprocentowanie w 1. roku:</span>
                <span className="font-semibold text-text-primary">{bondSettings.firstYearRate.toFixed(2)}%</span>
              </div>
            )}

            {preset.rateType === 'inflation' && (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-text-secondary">Marża:</span>
                  <span className="font-medium text-text-primary">{bondSettings.margin.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="text-text-secondary flex items-center gap-1">
                    Inflacja CPI
                    {inflationLoading && (
                      <span className="text-text-muted inline-flex items-center gap-1">
                        · <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />ładowanie…
                      </span>
                    )}
                    {inflationData && !inflationLoading && (
                      <Tooltip
                        content={`Źródło: ${inflationData.source}${inflationData.period ? ` (${inflationData.period})` : ''}.`}
                        side="bottom"
                      />
                    )}
                    :
                  </span>
                  <input
                    type="number"
                    min={-5}
                    max={30}
                    step={0.1}
                    value={inflationRate || ''}
                    onChange={(event) => onInflationRateChange(parseFloat(event.target.value) || 0)}
                    aria-label="Inflacja CPI (%)"
                    className="w-24 border border-border rounded bg-bg-card px-2 py-1 text-right text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  />
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-1.5">
                  <span className="text-text-secondary font-medium">Stopa efektywna (od 2. roku):</span>
                  <span className="font-bold text-text-primary">{bondEffectiveRate.toFixed(2)}%</span>
                </div>
              </>
            )}

            {preset.rateType === 'reference' && (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-text-secondary">Marża:</span>
                  <span className="font-medium text-text-primary">{bondSettings.margin.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="text-text-secondary flex items-center gap-1">
                    Stopa referencyjna NBP
                    <a
                      href="https://www.nbp.pl/polityka-pieniezna/instrumenty/stopy-procentowe.aspx"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Sprawdź aktualną stopę NBP"
                      className="text-accent-primary hover:text-accent-primary/80"
                    >
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                    :
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.25}
                    value={nbpRefRate || ''}
                    onChange={(event) => onNbpRefRateChange(parseFloat(event.target.value) || 0)}
                    aria-label="Stopa referencyjna NBP (%)"
                    className="w-24 border border-border rounded bg-bg-card px-2 py-1 text-right text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  />
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-1.5">
                  <span className="text-text-secondary font-medium">Stopa efektywna (od 2. okresu):</span>
                  <span className="font-bold text-text-primary">{bondEffectiveRate.toFixed(2)}%</span>
                </div>
              </>
            )}

            {preset.rateType === 'fixed' && (
              <div className="flex justify-between gap-4">
                <span className="text-text-secondary">Typ oprocentowania:</span>
                <span className="font-medium text-text-primary">Stałe przez cały okres</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">
                Kara za wcześniejszy wykup
              </label>
              <div className="w-full border border-border rounded-lg bg-bg-card px-3 py-2 text-sm text-text-primary">
                {bondSettings.penalty.toFixed(2)}%
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">
                Zapadalność
              </label>
              <div className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary">
                {preset.maturityMonths} mies.
              </div>
            </div>
          </div>

          <div className={`text-xs rounded-lg p-2.5 ${
            earlyExit
              ? 'bg-danger/5 text-danger'
              : 'bg-success/5 text-success'
          }`}>
            {earlyExit
              ? preset.earlyRedemptionAllowed
                ? `Wybrany horyzont (${horizonMonths} mies.) jest krótszy niż zapadalność ${preset.name} (${preset.maturityMonths} mies.), więc kalkulator uwzględnia karę ${preset.earlyRedemptionPenalty}%.`
                : `${preset.name} nie pozwala na wcześniejszy wykup. Wynik jest liczony dla pełnej zapadalności ${preset.maturityMonths} mies.`
              : 'Horyzont pokrywa zapadalność obligacji, więc nie ma kary za wykup.'}
          </div>

          <div className="text-[10px] text-text-muted">
            Źródło stawek:{' '}
            <a
              href="https://www.obligacjeskarbowe.pl/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-text-secondary"
            >
              obligacjeskarbowe.pl
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
