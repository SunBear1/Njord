/**
 * BondBenchmarkSection — Polish government bond preset selector and rate details.
 * Rendered inside InputPanel when benchmarkType === 'bonds'.
 */
import { Loader2, Info, ExternalLink } from 'lucide-react';
import type { BondPreset, BondSettings } from '../../types/scenario';
import type { InflationData } from '../../hooks/useInflationData';
import { BOND_PRESETS_LAST_UPDATED, BOND_PRESETS_SOURCE_URL } from '../../data/bondPresets';
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
  onBondSettingsChange: (s: BondSettings) => void;
  onInflationRateChange: (v: number) => void;
  onNbpRefRateChange: (v: number) => void;
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
  const preset = bondPresets.find((b) => b.id === selectedBondId);
  const earlyExit = preset ? horizonMonths < preset.maturityMonths : false;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="bond-type" className="text-sm font-medium text-text-secondary">
          Typ obligacji
        </label>
        <select
          id="bond-type"
          name="bondType"
          value={selectedBondId}
          onChange={(e) => {
            const p = bondPresets.find((b) => b.id === e.target.value);
            if (p) onSelectPreset(e.target.value, p);
          }}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
        >
          {bondPresetsLoading ? (
            <option disabled>Ładowanie…</option>
          ) : (
            bondPresets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.description}{b.isFamily ? ' (800+)' : ''}
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
              Obligacje rodzinne — dostępne tylko dla beneficjentów programu 800+.
            </div>
          )}

          <div className="bg-bg-card border border-border rounded-lg p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-secondary">Oprocentowanie 1. roku:</span>
              <span className="font-semibold text-text-primary">{bondSettings.firstYearRate.toFixed(2)}%</span>
            </div>

            {preset.rateType === 'inflation' && (
              <>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Marża:</span>
                  <span className="font-medium">{bondSettings.margin.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary flex items-center gap-1">
                    Inflacja CPI
                    {inflationLoading && (
                      <span className="text-border inline-flex items-center gap-1">
                        · <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />ładowanie…
                      </span>
                    )}
                    {inflationData && !inflationLoading && (
                      <Tooltip
                        content={`Źródło: ${inflationData.source}${inflationData.period ? ` (${inflationData.period})` : ''}. Obligacje indeksowane inflacją w rzeczywistości stosują odczyt CPI sprzed 2-3 miesięcy, nie bieżącą projekcję — przy stabilnej inflacji różnica jest minimalna.`}
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
                    onChange={(e) => onInflationRateChange(parseFloat(e.target.value) || 0)}
                    aria-label="Inflacja CPI (%)"
                    className="w-20 border border-border rounded px-2 py-0.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  />
                </div>
                <div className="flex justify-between border-t border-border pt-1.5">
                  <span className="text-text-secondary font-medium">Stopa efektywna (od 2. roku):</span>
                  <span className="font-bold text-accent-primary/80">{bondEffectiveRate.toFixed(2)}%</span>
                </div>
              </>
            )}

            {preset.rateType === 'reference' && (
              <>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Marża:</span>
                  <span className="font-medium">{bondSettings.margin.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary flex items-center gap-1">
                    Stopa referencyjna NBP:
                    <a
                      href="https://www.nbp.pl/polityka-pieniezna/instrumenty/stopy-procentowe.aspx"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Sprawdź aktualną stopę NBP"
                      className="text-accent-primary hover:text-accent-primary/80"
                    >
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.25}
                    value={nbpRefRate || ''}
                    onChange={(e) => onNbpRefRateChange(parseFloat(e.target.value) || 0)}
                    placeholder="np. 5.75"
                    aria-label="Stopa referencyjna NBP (%)"
                    className="w-20 border border-border rounded px-2 py-0.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  />
                </div>
                <div className="flex justify-between border-t border-border pt-1.5">
                  <span className="text-text-secondary font-medium">Stopa efektywna (od 2. okresu):</span>
                  <span className="font-bold text-accent-primary/80">{bondEffectiveRate.toFixed(2)}%</span>
                </div>
              </>
            )}

            {preset.rateType === 'fixed' && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Typ:</span>
                <span className="font-medium">Stała stopa przez cały okres</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="bond-penalty" className="text-sm font-medium text-text-secondary">
                Kara za wcz. wykup
                <span className="ml-1 text-xs font-normal text-text-muted">(% kapitału)</span>
              </label>
              <input
                id="bond-penalty"
                name="bondPenalty"
                autoComplete="off"
                type="number"
                min={0}
                max={10}
                step={0.01}
                value={bondSettings.penalty}
                onChange={(e) => {
                  onBondSettingsChange({ ...bondSettings, penalty: parseFloat(e.target.value) || 0 });
                }}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">
                Zapadalność
              </label>
              <div className="px-3 py-2 text-sm text-text-secondary bg-bg-card border border-border rounded-lg">
                {preset.maturityMonths} mies.
              </div>
            </div>
          </div>

          <div className={`text-xs rounded-lg p-2.5 ${
            earlyExit
              ? preset.earlyRedemptionAllowed
                ? 'bg-danger/5 text-danger'
                : 'bg-danger/5 text-danger '
              : 'bg-success/5 text-success'
          }`}>
            {earlyExit
              ? preset.earlyRedemptionAllowed
                ? `Horyzont (${horizonMonths} mies.) < zapadalność ${preset.name} (${preset.maturityMonths} mies.) — kara za wcześniejszy wykup: ${preset.earlyRedemptionPenalty}% kapitału.`
                : `${preset.name} nie pozwala na wcześniejszy wykup. Wyniki obliczone dla pełnego okresu zapadalności (${preset.maturityMonths} mies.).`
              : `Horyzont pokrywa okres zapadalności obligacji — brak kary za wykup.`}
          </div>
          <div className="text-[10px] text-border mt-1">
            Stawki z {BOND_PRESETS_LAST_UPDATED}.{' '}
            <a href={BOND_PRESETS_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-text-muted ">
              Aktualne stawki na obligacjeskarbowe.pl
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
