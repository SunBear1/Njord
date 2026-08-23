import { useState } from 'react';
import type { HoldingDraft, HoldingAssetClass } from '../../types/holding';
import type { BondPreset } from '../../types/scenario';

interface HoldingFormProps {
  bondPresets: BondPreset[];
  onSubmit: (draft: HoldingDraft) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

const inputClass = 'w-full px-3 py-2 rounded-lg border border-bg-muted bg-bg-card text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-neutral/50';
const labelClass = 'block text-sm font-medium text-text-secondary mb-1';

export function HoldingForm({ bondPresets, onSubmit, onCancel, submitLabel = 'Dodaj' }: HoldingFormProps) {
  const [assetClass, setAssetClass] = useState<HoldingAssetClass>('bond');
  const [bondPresetId, setBondPresetId] = useState(bondPresets[0]?.id ?? '');
  const [bankName, setBankName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestRatePercent, setInterestRatePercent] = useState('');
  const [dateField, setDateField] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState('manual');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const principalNum = Number(principal);
    if (!Number.isFinite(principalNum) || principalNum <= 0) {
      setError('Kwota musi być liczbą dodatnią.');
      return;
    }

    if (assetClass === 'bond') {
      if (!bondPresetId) {
        setError('Wybierz typ obligacji.');
        return;
      }
      onSubmit({ assetClass: 'bond', bondPresetId, principal: principalNum, purchaseDate: dateField, source });
    } else {
      const rateNum = Number(interestRatePercent);
      if (!Number.isFinite(rateNum) || rateNum < 0) {
        setError('Stawka musi być liczbą nieujemną.');
        return;
      }
      if (!bankName.trim()) {
        setError('Podaj nazwę banku.');
        return;
      }
      onSubmit({ assetClass: 'savings', bankName: bankName.trim(), principal: principalNum, interestRatePercent: rateNum, asOfDate: dateField, source });
    }

    setPrincipal('');
    setBankName('');
    setInterestRatePercent('');
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="holding-class" className={labelClass}>Rodzaj</label>
        <select
          id="holding-class"
          value={assetClass}
          onChange={(e) => setAssetClass(e.target.value as HoldingAssetClass)}
          className={inputClass}
        >
          <option value="bond">Obligacja skarbowa</option>
          <option value="savings">Konto oszczędnościowe</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assetClass === 'bond' ? (
          <div className="md:col-span-2">
            <label htmlFor="holding-bond-preset" className={labelClass}>Typ obligacji</label>
            <select
              id="holding-bond-preset"
              value={bondPresetId}
              onChange={(e) => setBondPresetId(e.target.value)}
              className={inputClass}
            >
              {bondPresets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="md:col-span-2">
            <label htmlFor="holding-bank" className={labelClass}>Bank</label>
            <input
              id="holding-bank"
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="np. Toyota Bank"
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label htmlFor="holding-principal" className={labelClass}>Kwota (PLN)</label>
          <input
            id="holding-principal"
            type="number"
            min="0"
            step="any"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        {assetClass === 'savings' && (
          <div>
            <label htmlFor="holding-rate" className={labelClass}>Stawka (% rocznie)</label>
            <input
              id="holding-rate"
              type="number"
              min="0"
              step="any"
              value={interestRatePercent}
              onChange={(e) => setInterestRatePercent(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label htmlFor="holding-date" className={labelClass}>
            {assetClass === 'bond' ? 'Data zakupu' : 'Stan na dzień'}
          </label>
          <input
            id="holding-date"
            type="date"
            value={dateField}
            onChange={(e) => setDateField(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="holding-source" className={labelClass}>Źródło</label>
          <input
            id="holding-source"
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="np. XTB, manual"
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
