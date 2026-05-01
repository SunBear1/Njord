import { useState, useCallback, useMemo } from 'react';
import {
  Shield,
  PiggyBank,
  Wallet,
  ChevronDown,
  ChevronUp,
  Plus,
  TrendingUp,
  Landmark,
  Banknote,
} from 'lucide-react';
import { fetchAssetData } from '../../providers/twelveDataProvider';
import { toErrorMessage } from '../../utils/formatting';
import type {
  WrapperPortfolioConfig,
  PortfolioAllocation,
  WizardState,
  PortfolioInstrumentType,
} from '../../types/portfolio';
import { BROKERS, ETF_PRESETS } from '../../types/portfolio';
import type { BondPreset } from '../../types/scenario';
import { adjustAllocation } from '../../utils/allocationValidation';
import { fmtPLN } from '../../utils/formatting';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Step3Props {
  state: WizardState;
  updateWrapperConfig: (index: 0 | 1 | 2, config: Partial<WrapperPortfolioConfig>) => void;
  setReinvestIkzeDeduction: (reinvest: boolean) => void;
  ikeMonthlyAllocation: number;
  ikzeMonthlyAllocation: number;
  surplusMonthly: number;
  ikzePitDeductionAnnual: number;
  bondPresets: BondPreset[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSTRUMENT_COLORS: Record<PortfolioInstrumentType, string> = {
  etf: 'bg-accent',
  stocks_pl: 'bg-indigo-500',
  stocks_foreign: 'bg-violet-500',
  bonds: 'bg-amber-500',
  savings: 'bg-emerald-500',
};

const INSTRUMENT_LABELS: Record<PortfolioInstrumentType, string> = {
  etf: 'ETF',
  stocks_pl: 'Akcje PL',
  stocks_foreign: 'Akcje zagr.',
  bonds: 'Obligacje',
  savings: 'Lokata',
};

function instrumentLabel(a: PortfolioAllocation): string {
  if (a.displayName) return a.displayName;
  if (a.instrumentType === 'savings') return 'Lokata / konto oszczędnościowe';
  if (a.instrumentType === 'bonds') return a.instrumentId;
  const etf = ETF_PRESETS.find((e) => e.id === a.instrumentId);
  return etf ? etf.name : a.instrumentId;
}

function instrumentSubtitle(
  a: PortfolioAllocation,
  bondPresets: BondPreset[],
): string | null {
  if (a.instrumentType === 'etf') {
    const etf = ETF_PRESETS.find((e) => e.id === a.instrumentId);
    return etf ? `Historyczna stopa: ~${etf.historicalReturnPercent}% rocznie` : null;
  }
  if (a.instrumentType === 'bonds') {
    const bond = bondPresets.find((b) => b.id === a.instrumentId);
    return bond ? `Oprocentowanie: ${bond.firstYearRate}% (I rok)` : null;
  }
  return null;
}

type InstrumentOption = {
  instrumentId: string;
  instrumentType: PortfolioInstrumentType;
  label: string;
  defaultReturn: number;
  displayName?: string;
};

function getAvailableOptions(
  instruments: PortfolioInstrumentType[],
  bondPresets: BondPreset[],
  isBeneficiary800Plus: boolean,
  isRegular: boolean,
): InstrumentOption[] {
  const options: InstrumentOption[] = [];

  const hasEtf = instruments.includes('etf') || isRegular;
  const hasBonds = instruments.includes('bonds') || isRegular;

  if (hasEtf) {
    for (const etf of ETF_PRESETS) {
      options.push({
        instrumentId: etf.id,
        instrumentType: 'etf',
        label: etf.name,
        defaultReturn: etf.historicalReturnPercent,
      });
    }
  }

  if (hasBonds) {
    for (const bond of bondPresets) {
      if (bond.isFamily && !isBeneficiary800Plus) continue;
      const maturityLabel = bond.maturityMonths >= 12
        ? `${bond.maturityMonths / 12} lat`
        : `${bond.maturityMonths} mies.`;
      const rateLabel = bond.rateType === 'fixed' ? 'stałe' : bond.rateType === 'reference' ? 'zmienne' : 'inflacja';
      options.push({
        instrumentId: bond.id,
        instrumentType: 'bonds',
        label: `${bond.id} — ${bond.name} (${maturityLabel}, ${rateLabel})`,
        defaultReturn: bond.firstYearRate,
      });
    }
  }

  if (isRegular) {
    options.push({
      instrumentId: 'savings',
      instrumentType: 'savings',
      label: 'Lokata / konto oszczędnościowe',
      defaultReturn: 5,
    });
  }

  return options;
}

// ─── AllocationBar ────────────────────────────────────────────────────────────

function AllocationBar({
  allocations,
  wrapperMonthlyPLN,
}: {
  allocations: readonly PortfolioAllocation[];
  wrapperMonthlyPLN: number;
}) {
  const sum = allocations.reduce((s, a) => s + a.allocationPercent, 0);
  const valid = Math.abs(sum - 100) < 0.1;

  return (
    <div className="mb-4">
      <div className="flex h-5 rounded-lg overflow-hidden border border-edge dark:border-edge-strong">
        {allocations.map((a, i) => (
          <div
            key={`${a.instrumentId}-${i}`}
            className={`${INSTRUMENT_COLORS[a.instrumentType]}`}
            style={{ width: `${Math.max(a.allocationPercent, 0)}%` }}
            title={`${instrumentLabel(a)}: ${Math.round(a.allocationPercent)}% · ${fmtPLN(wrapperMonthlyPLN * a.allocationPercent / 100)}/mies.`}
          />
        ))}
        {sum < 99.9 ? (
          <div
            className="bg-surface-muted dark:bg-surface-dark-alt"
            style={{ width: `${100 - sum}%` }}
          />
        ) : null}
      </div>
      <div className="mt-1 flex items-center gap-3 text-xs">
        <span className={valid ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
          {valid ? '✓' : '⚠'} {Math.round(sum)}%
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {allocations.map((a, i) => {
            const plnAmount = wrapperMonthlyPLN * a.allocationPercent / 100;
            return (
              <span key={`${a.instrumentId}-${i}`} className="flex items-center gap-1">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-sm ${INSTRUMENT_COLORS[a.instrumentType]}`}
                />
                <span className="text-body dark:text-on-dark-muted">
                  {INSTRUMENT_LABELS[a.instrumentType]} {Math.round(a.allocationPercent)}%
                </span>
                <span className="text-faint dark:text-muted">
                  ({fmtPLN(plnAmount)})
                </span>
              </span>
            );
          })}
        </div>
        {!valid ? (
          <span className="text-red-500 text-xs ml-auto">
            Suma alokacji musi wynosić 100%
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─── AllocationRow ────────────────────────────────────────────────────────────

interface AllocationRowProps {
  allocation: PortfolioAllocation;
  index: number;
  bondPresets: BondPreset[];
  wrapperMonthlyPLN: number;
  onSliderChange: (index: number, newPercent: number) => void;
  onReturnChange: (index: number, newReturn: number) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

function typeIcon(type: PortfolioInstrumentType) {
  switch (type) {
    case 'etf':
    case 'stocks_pl':
    case 'stocks_foreign':
      return <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />;
    case 'bonds':
      return <Landmark className="h-3.5 w-3.5" aria-hidden="true" />;
    case 'savings':
      return <Banknote className="h-3.5 w-3.5" aria-hidden="true" />;
  }
}

function AllocationRow({
  allocation,
  index,
  bondPresets,
  wrapperMonthlyPLN,
  onSliderChange,
  onReturnChange,
  onRemove,
  canRemove,
}: AllocationRowProps) {
  const subtitle = instrumentSubtitle(allocation, bondPresets);
  const plnAmount = wrapperMonthlyPLN * allocation.allocationPercent / 100;

  return (
    <div className="p-4 border-b border-edge dark:border-edge-strong last:border-0">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-on-dark ${INSTRUMENT_COLORS[allocation.instrumentType]}`}
            >
              {typeIcon(allocation.instrumentType)}
              {INSTRUMENT_LABELS[allocation.instrumentType]}
            </span>
            <span className="text-sm font-medium text-heading dark:text-on-dark truncate">
              {instrumentLabel(allocation)}
            </span>
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted dark:text-muted">{subtitle}</p>
          ) : null}
          <p className="mt-0.5 text-xs font-medium text-accent dark:text-accent">
            {fmtPLN(plnAmount)}/mies.
          </p>
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label="Usuń instrument"
            className="shrink-0 rounded p-1 text-faint hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <span aria-hidden="true" className="text-xs font-bold">✕</span>
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 items-center">
        <div>
          <label className="text-xs text-muted dark:text-muted">Alokacja</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(allocation.allocationPercent)}
              onChange={(e) => onSliderChange(index, Number(e.target.value))}
              className="w-full accent-blue-600"
              aria-label={`Alokacja ${instrumentLabel(allocation)}`}
            />
            <span className="w-12 text-right text-sm font-mono text-body dark:text-on-dark-muted">
              {Math.round(allocation.allocationPercent)}%
            </span>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted dark:text-muted">Oczekiwana stopa</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={-50}
              max={100}
              step={0.1}
              value={allocation.expectedReturnPercent}
              onChange={(e) => onReturnChange(index, Number(e.target.value))}
              className="w-20 rounded-md border border-edge-strong dark:border-edge-strong bg-surface dark:bg-surface-dark-alt px-2 py-1 text-xs font-mono text-right text-heading dark:text-on-dark focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              aria-label={`Oczekiwana stopa zwrotu ${instrumentLabel(allocation)}`}
            />
            <span className="text-xs text-muted dark:text-muted">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AddInstrumentMenu ────────────────────────────────────────────────────────

interface AddInstrumentMenuProps {
  options: InstrumentOption[];
  existingIds: Set<string>;
  onAdd: (option: InstrumentOption) => void;
}

function AddInstrumentMenu({ options, existingIds, onAdd }: AddInstrumentMenuProps) {
  const [open, setOpen] = useState(false);
  const [customTicker, setCustomTicker] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const available = options.filter((o) => !existingIds.has(o.instrumentId));

  // Group available options by category
  const etfOptions = available.filter((o) => o.instrumentType === 'etf' || o.instrumentType === 'stocks_pl' || o.instrumentType === 'stocks_foreign');
  const bondOptions = available.filter((o) => o.instrumentType === 'bonds');
  const savingsOptions = available.filter((o) => o.instrumentType === 'savings');

  const handleCustomEtfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ticker = customTicker.trim();
    if (!ticker || isSearching) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const data = await fetchAssetData(ticker.toUpperCase());
      const name = data.assetData?.asset?.name ?? ticker;

      onAdd({
        instrumentId: ticker.toUpperCase(),
        instrumentType: 'etf',
        label: `${ticker.toUpperCase()} — ${name}`,
        defaultReturn: 8,
        displayName: name !== ticker.toUpperCase() ? `${name} (${ticker.toUpperCase()})` : ticker.toUpperCase(),
      });
      setCustomTicker('');
      setOpen(false);
    } catch (err) {
      setSearchError(toErrorMessage(err, 'Błąd wyszukiwania'));
    } finally {
      setIsSearching(false);
    }
  };

  const renderOption = (opt: InstrumentOption) => (
    <button
      key={opt.instrumentId}
      type="button"
      onClick={() => {
        onAdd(opt);
        setOpen(false);
      }}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-body dark:text-on-dark-muted hover:bg-surface-alt dark:hover:bg-surface-dark-alt"
    >
      <span
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm ${INSTRUMENT_COLORS[opt.instrumentType]}`}
      />
      <span className="min-w-0 truncate">{opt.label}</span>
      <span className="ml-auto shrink-0 text-xs text-faint">{opt.defaultReturn}%</span>
    </button>
  );

  return (
    <div className="relative p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-accent dark:text-accent hover:text-accent-hover dark:hover:text-accent font-medium"
        aria-label="Dodaj instrument"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Dodaj instrument
      </button>
      {open ? (
        <div className="absolute left-3 z-10 mt-1 w-96 rounded-lg border border-edge dark:border-edge-strong bg-surface dark:bg-surface-dark shadow-lg">
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {/* ETF / Stocks section */}
            {etfOptions.length > 0 ? (
              <div>
                <div className="sticky top-0 bg-surface-alt dark:bg-surface-dark-alt px-3 py-1.5 text-xs font-semibold text-muted dark:text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" aria-hidden="true" />
                  ETF / Akcje
                </div>
                {etfOptions.map(renderOption)}
              </div>
            ) : null}

            {/* Bonds section */}
            {bondOptions.length > 0 ? (
              <div>
                <div className="sticky top-0 bg-surface-alt dark:bg-surface-dark-alt px-3 py-1.5 text-xs font-semibold text-muted dark:text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="h-3 w-3" aria-hidden="true" />
                  Obligacje skarbowe
                </div>
                {bondOptions.map(renderOption)}
              </div>
            ) : null}

            {/* Savings section */}
            {savingsOptions.length > 0 ? (
              <div>
                <div className="sticky top-0 bg-surface-alt dark:bg-surface-dark-alt px-3 py-1.5 text-xs font-semibold text-muted dark:text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Banknote className="h-3 w-3" aria-hidden="true" />
                  Lokata
                </div>
                {savingsOptions.map(renderOption)}
              </div>
            ) : null}

            {available.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted dark:text-muted">
                Wszystkie dostępne instrumenty zostały już dodane
              </div>
            ) : null}
          </div>
          {/* Custom ETF search */}
          <div className="border-t border-edge dark:border-edge-strong p-3">
            <p className="text-xs text-muted dark:text-muted mb-2">
              Wyszukaj dowolny ETF lub akcję po tickerze (Yahoo Finance)
            </p>
            <form onSubmit={handleCustomEtfSubmit} className="flex gap-2">
              <input
                type="text"
                value={customTicker}
                onChange={(e) => setCustomTicker(e.target.value.toUpperCase())}
                placeholder="np. IWDA.AS, VOO, AAPL…"
                className="flex-1 rounded-md border border-edge-strong dark:border-edge-strong bg-surface dark:bg-surface-dark-alt px-2 py-1.5 text-xs text-heading dark:text-on-dark placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="submit"
                disabled={!customTicker.trim() || isSearching}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-on-dark hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? '...' : 'Szukaj'}
              </button>
            </form>
            {searchError ? (
              <p className="mt-1 text-xs text-red-500">{searchError}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── WrapperSection ───────────────────────────────────────────────────────────

interface WrapperSectionProps {
  icon: React.ReactNode;
  title: string;
  amount: string;
  wrapperMonthlyPLN: number;
  taxBenefit: string;
  wrapperIndex: 0 | 1 | 2;
  config: WrapperPortfolioConfig;
  availableOptions: InstrumentOption[];
  bondPresets: BondPreset[];
  updateWrapperConfig: (index: 0 | 1 | 2, config: Partial<WrapperPortfolioConfig>) => void;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}

function WrapperSection({
  icon,
  title,
  amount,
  wrapperMonthlyPLN,
  taxBenefit,
  wrapperIndex,
  config,
  availableOptions,
  bondPresets,
  updateWrapperConfig,
  children,
  defaultOpen = true,
}: WrapperSectionProps) {
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const allocations = config.allocations;

  const existingIds = useMemo(
    () => new Set(allocations.map((a) => a.instrumentId)),
    [allocations],
  );

  const handleSliderChange = useCallback(
    (index: number, newPercent: number) => {
      const adjusted = adjustAllocation(allocations, index, newPercent);
      updateWrapperConfig(wrapperIndex, { allocations: adjusted });
    },
    [allocations, wrapperIndex, updateWrapperConfig],
  );

  const handleReturnChange = useCallback(
    (index: number, newReturn: number) => {
      const updated = allocations.map((a, i) =>
        i === index ? { ...a, expectedReturnPercent: newReturn } : a,
      );
      updateWrapperConfig(wrapperIndex, { allocations: updated });
    },
    [allocations, wrapperIndex, updateWrapperConfig],
  );

  const handleRemove = useCallback(
    (index: number) => {
      if (allocations.length <= 1) return;
      const remaining = allocations.filter((_, i) => i !== index);
      // Redistribute removed allocation proportionally
      const removedPct = allocations[index].allocationPercent;
      const othersSum = remaining.reduce((s, a) => s + a.allocationPercent, 0);
      const normalized = remaining.map((a) => ({
        ...a,
        allocationPercent:
          othersSum > 0
            ? Math.round(((a.allocationPercent / othersSum) * (othersSum + removedPct)) * 100) / 100
            : 100 / remaining.length,
      }));
      updateWrapperConfig(wrapperIndex, { allocations: normalized });
    },
    [allocations, wrapperIndex, updateWrapperConfig],
  );

  const handleAdd = useCallback(
    (option: InstrumentOption) => {
      const newAllocation: PortfolioAllocation = {
        instrumentId: option.instrumentId,
        instrumentType: option.instrumentType,
        allocationPercent: 0,
        expectedReturnPercent: option.defaultReturn,
        displayName: option.displayName,
      };
      updateWrapperConfig(wrapperIndex, {
        allocations: [...allocations, newAllocation],
      });
    },
    [allocations, wrapperIndex, updateWrapperConfig],
  );

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-xl border border-edge dark:border-edge-strong shadow-sm">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-surface-alt dark:hover:bg-surface-dark-alt/50 transition-colors rounded-t-xl"
        aria-expanded={!collapsed}
      >
        <span className="shrink-0 text-accent dark:text-accent">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-heading dark:text-on-dark">
              {title}
            </span>
            <span className="rounded-full bg-accent-light dark:bg-surface-dark/30 px-2.5 py-0.5 text-xs font-medium text-accent-hover dark:text-accent">
              {amount}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted dark:text-muted">{taxBenefit}</p>
        </div>
        {collapsed ? (
          <ChevronDown className="h-5 w-5 shrink-0 text-faint" aria-hidden="true" />
        ) : (
          <ChevronUp className="h-5 w-5 shrink-0 text-faint" aria-hidden="true" />
        )}
      </button>

      {!collapsed ? (
        <div className="border-t border-edge dark:border-edge-strong px-5 py-4">
          {children}

          {allocations.length > 0 ? (
            <AllocationBar allocations={allocations} wrapperMonthlyPLN={wrapperMonthlyPLN} />
          ) : null}

          {allocations.map((a, i) => (
            <AllocationRow
              key={`${a.instrumentId}-${i}`}
              allocation={a}
              index={i}
              bondPresets={bondPresets}
              wrapperMonthlyPLN={wrapperMonthlyPLN}
              onSliderChange={handleSliderChange}
              onReturnChange={handleReturnChange}
              onRemove={handleRemove}
              canRemove={allocations.length > 1}
            />
          ))}

          <AddInstrumentMenu
            options={availableOptions}
            existingIds={existingIds}
            onAdd={handleAdd}
          />
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Step3Allocation({
  state,
  updateWrapperConfig,
  setReinvestIkzeDeduction,
  ikeMonthlyAllocation,
  ikzeMonthlyAllocation,
  surplusMonthly,
  ikzePitDeductionAnnual,
  bondPresets,
}: Step3Props) {
  const { ikeEnabled, ikzeEnabled, wrapperConfigs, personalData } = state;
  const [ikeConfig, ikzeConfig, regularConfig] = wrapperConfigs;

  const ikeBroker = BROKERS.find((b) => b.id === state.ikeBrokerId);
  const ikzeBroker = BROKERS.find((b) => b.id === state.ikzeBrokerId);

  const ikeOptions = useMemo(
    () =>
      getAvailableOptions(
        ikeBroker?.instruments ?? [],
        bondPresets,
        personalData.isBeneficiary800Plus,
        false,
      ),
    [ikeBroker, bondPresets, personalData.isBeneficiary800Plus],
  );

  const ikzeOptions = useMemo(
    () =>
      getAvailableOptions(
        ikzeBroker?.instruments ?? [],
        bondPresets,
        personalData.isBeneficiary800Plus,
        false,
      ),
    [ikzeBroker, bondPresets, personalData.isBeneficiary800Plus],
  );

  const regularOptions = useMemo(
    () =>
      getAvailableOptions([], bondPresets, personalData.isBeneficiary800Plus, true),
    [bondPresets, personalData.isBeneficiary800Plus],
  );

  return (
    <div className="space-y-4">
      {/* IKE */}
      {ikeEnabled ? (
        <WrapperSection
          icon={<Shield className="h-5 w-5" aria-hidden="true" />}
          title="Portfel IKE"
          amount={`${fmtPLN(ikeMonthlyAllocation)}/mies.`}
          wrapperMonthlyPLN={ikeMonthlyAllocation}
          taxBenefit="0% podatku od zysków po 60. roku życia"
          wrapperIndex={0}
          config={ikeConfig}
          availableOptions={ikeOptions}
          bondPresets={bondPresets}
          updateWrapperConfig={updateWrapperConfig}
        />
      ) : null}

      {/* IKZE */}
      {ikzeEnabled ? (
        <WrapperSection
          icon={<PiggyBank className="h-5 w-5" aria-hidden="true" />}
          title="Portfel IKZE"
          amount={`${fmtPLN(ikzeMonthlyAllocation)}/mies.`}
          wrapperMonthlyPLN={ikzeMonthlyAllocation}
          taxBenefit={`Odliczenie od PIT: ${fmtPLN(ikzePitDeductionAnnual)}/rok · 10% ryczałt przy wypłacie`}
          wrapperIndex={1}
          config={ikzeConfig}
          availableOptions={ikzeOptions}
          bondPresets={bondPresets}
          updateWrapperConfig={updateWrapperConfig}
        >
          <div className="mb-4 rounded-lg bg-surface-alt dark:bg-surface-dark-alt/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-heading dark:text-on-dark-muted">
                  Reinwestuj ulgę podatkową z IKZE?
                </p>
                {state.reinvestIkzeDeduction ? (
                  <p className="mt-0.5 text-xs text-muted dark:text-muted">
                    Ulga {fmtPLN(ikzePitDeductionAnnual)}/rok jest reinwestowana na koncie
                    oszczędnościowym
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted dark:text-muted">
                    Ulga podatkowa nie jest wliczana do symulacji
                  </p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={state.reinvestIkzeDeduction}
                aria-label="Reinwestuj ulgę podatkową z IKZE"
                onClick={() => setReinvestIkzeDeduction(!state.reinvestIkzeDeduction)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  state.reinvestIkzeDeduction
                    ? 'bg-accent dark:bg-accent'
                    : 'bg-surface-muted dark:bg-surface-dark-alt'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition-transform ${
                    state.reinvestIkzeDeduction ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </WrapperSection>
      ) : null}

      {/* Surplus / Regular */}
      {surplusMonthly > 0 ? (
        <WrapperSection
          icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
          title="Nadwyżka"
          amount={`${fmtPLN(surplusMonthly)}/mies.`}
          wrapperMonthlyPLN={surplusMonthly}
          taxBenefit="Kwota ponad limity IKE + IKZE · 19% Belka od zysków"
          wrapperIndex={2}
          config={regularConfig}
          availableOptions={regularOptions}
          bondPresets={bondPresets}
          updateWrapperConfig={updateWrapperConfig}
        />
      ) : null}
    </div>
  );
}
