import { useState } from 'react';
import type { BondHoldingDraft } from '../../types/holding';
import type { BondPreset } from '../../types/scenario';

interface BondSecurityFormProps {
  bondPresets: BondPreset[];
  onSubmit: (draft: BondHoldingDraft) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

const inputClass = 'w-full px-3 py-2 rounded-lg border border-bg-muted bg-bg-card text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-neutral/50';
const labelClass = 'block text-sm font-medium text-text-secondary mb-1';

export function BondSecurityForm({ bondPresets, onSubmit, onCancel, submitLabel = 'Dodaj' }: BondSecurityFormProps) {
  const [bondPresetId, setBondPresetId] = useState(bondPresets[0]?.id ?? '');
  const [principal, setPrincipal] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState('manual');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const principalNum = Number(principal);
    if (!Number.isFinite(principalNum) || principalNum <= 0) {
      setError('Kwota musi być liczbą dodatnią.');
      return;
    }
    if (!bondPresetId) {
      setError('Wybierz typ obligacji.');
      return;
    }
    onSubmit({ assetClass: 'bond', bondPresetId, principal: principalNum, purchaseDate, source });
    setPrincipal('');
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="bond-preset" className={labelClass}>Typ obligacji</label>
          <select
            id="bond-preset"
            value={bondPresetId}
            onChange={(e) => setBondPresetId(e.target.value)}
            className={inputClass}
          >
            {bondPresets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="bond-principal" className={labelClass}>Kwota (PLN)</label>
          <input
            id="bond-principal"
            type="number"
            min="0"
            step="any"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="bond-purchase-date" className={labelClass}>Data zakupu</label>
          <input
            id="bond-purchase-date"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="bond-source" className={labelClass}>Źródło</label>
          <input
            id="bond-source"
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="np. Obligacjeskarbowe.pl, manual"
            className={inputClass}
          />
        </div>
      </div>

      {error && <p className="text-xs text-loss">{error}</p>}

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
            Anuluj
          </button>
        )}
        <button type="submit" className="px-4 py-2 text-sm font-medium bg-neutral text-white rounded-lg hover:opacity-90 transition-opacity">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
