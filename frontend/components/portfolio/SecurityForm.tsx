import { useState } from 'react';
import type { PositionDraft } from '../../types/position';
import type { BondHoldingDraft } from '../../types/holding';
import type { BondPreset } from '../../types/scenario';
import { StockSecurityForm } from './StockSecurityForm';
import { BondSecurityForm } from './BondSecurityForm';

type SecurityKind = 'stock' | 'bond';
export type SecurityDraftResult =
  | { assetClass: 'stock'; draft: PositionDraft }
  | { assetClass: 'bond'; draft: BondHoldingDraft };

interface SecurityFormProps {
  bondPresets: BondPreset[];
  onSubmit: (result: SecurityDraftResult) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function SecurityForm({ bondPresets, onSubmit, onCancel, submitLabel }: SecurityFormProps) {
  const [kind, setKind] = useState<SecurityKind>('stock');

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="security-kind" className="block text-sm font-medium text-text-secondary mb-1">Rodzaj</label>
        <select
          id="security-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as SecurityKind)}
          className="w-full px-3 py-2 rounded-lg border border-bg-muted bg-bg-card text-text-primary focus:outline-none focus:ring-2 focus:ring-neutral/50"
        >
          <option value="stock">Akcja / ETF</option>
          <option value="bond">Obligacja skarbowa</option>
        </select>
      </div>

      {kind === 'stock' ? (
        <StockSecurityForm
          onSubmit={(draft) => onSubmit({ assetClass: 'stock', draft })}
          onCancel={onCancel}
          submitLabel={submitLabel}
        />
      ) : (
        <BondSecurityForm
          bondPresets={bondPresets}
          onSubmit={(draft) => onSubmit({ assetClass: 'bond', draft })}
          onCancel={onCancel}
          submitLabel={submitLabel}
        />
      )}
    </div>
  );
}
