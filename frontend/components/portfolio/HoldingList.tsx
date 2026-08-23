import type { BondHolding, SavingsHolding } from '../../types/holding';
import type { BondPreset } from '../../types/scenario';
import { calcBondHoldingCurrentValue, calcSavingsHoldingCurrentValue } from '../../utils/holdingValue';

type ListableHolding = BondHolding | SavingsHolding;

interface HoldingListProps {
  holdings: ListableHolding[];
  bondPresets: BondPreset[];
  onDelete: (id: string) => void;
}

function formatPLN(value: number): string {
  return `${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

function currentValue(holding: ListableHolding, bondPresets: BondPreset[]): number | null {
  if (holding.assetClass === 'bond') {
    const preset = bondPresets.find((p) => p.id === holding.bondPresetId);
    return preset ? calcBondHoldingCurrentValue(holding, preset) : null;
  }
  return calcSavingsHoldingCurrentValue(holding);
}

function label(holding: ListableHolding, bondPresets: BondPreset[]): string {
  if (holding.assetClass === 'bond') {
    return bondPresets.find((p) => p.id === holding.bondPresetId)?.name ?? holding.bondPresetId;
  }
  return holding.bankName;
}

export function HoldingList({ holdings, bondPresets, onDelete }: HoldingListProps) {
  if (holdings.length === 0) {
    return <p className="text-sm text-text-muted">Brak dodanych obligacji i kont oszczędnościowych.</p>;
  }

  return (
    <ul className="space-y-2">
      {holdings.map((holding) => {
        const value = currentValue(holding, bondPresets);
        return (
          <li
            key={holding.id}
            className="flex items-center justify-between gap-4 bg-bg-card rounded-xl p-3 border border-bg-muted"
          >
            <div>
              <p className="text-sm font-medium text-text-primary">{label(holding, bondPresets)}</p>
              <p className="text-xs text-text-muted">
                {holding.assetClass === 'bond' ? 'Obligacja skarbowa' : 'Konto oszczędnościowe'}
                {holding.source ? ` · ${holding.source}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-text-primary">
                  {value !== null ? formatPLN(value) : '—'}
                </p>
                <p className="text-xs text-text-muted">wpłacono {formatPLN(holding.principal)}</p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(holding.id)}
                className="px-2 py-1 text-xs text-loss hover:opacity-80 transition-opacity"
              >
                Usuń
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
