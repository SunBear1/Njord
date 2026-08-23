import { useState } from 'react';
import type { HoldingDraft } from '../../types/holding';

type CashAssetClass = 'savings' | 'termDeposit';

interface HoldingFormProps {
  onSubmit: (draft: HoldingDraft) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

const inputClass = 'w-full px-3 py-2 rounded-lg border border-bg-muted bg-bg-card text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-neutral/50';
const labelClass = 'block text-sm font-medium text-text-secondary mb-1';

const today = () => new Date().toISOString().slice(0, 10);

export function HoldingForm({ onSubmit, onCancel, submitLabel = 'Dodaj' }: HoldingFormProps) {
  const [assetClass, setAssetClass] = useState<CashAssetClass>('savings');
  const [bankName, setBankName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestRatePercent, setInterestRatePercent] = useState('');
  const [asOfDate, setAsOfDate] = useState(today());
  const [openDate, setOpenDate] = useState(today());
  const [maturityDate, setMaturityDate] = useState(today());
  const [source, setSource] = useState('manual');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const principalNum = Number(principal);
    if (!Number.isFinite(principalNum) || principalNum <= 0) {
      setError('Kwota musi być liczbą dodatnią.');
      return;
    }
    const rateNum = Number(interestRatePercent);
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      setError('Stawka musi być liczbą nieujemną.');
      return;
    }
    if (!bankName.trim()) {
      setError('Podaj nazwę banku.');
      return;
    }

    if (assetClass === 'savings') {
      onSubmit({ assetClass: 'savings', bankName: bankName.trim(), principal: principalNum, interestRatePercent: rateNum, asOfDate, source });
    } else {
      if (maturityDate <= openDate) {
        setError('Data zapadalności musi być późniejsza niż data otwarcia.');
        return;
      }
      onSubmit({ assetClass: 'termDeposit', bankName: bankName.trim(), principal: principalNum, interestRatePercent: rateNum, openDate, maturityDate, source });
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
          onChange={(e) => setAssetClass(e.target.value as CashAssetClass)}
          className={inputClass}
        >
          <option value="savings">Konto oszczędnościowe</option>
          <option value="termDeposit">Lokata</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <div>
          <label htmlFor="holding-rate" className={labelClass}>
            {assetClass === 'termDeposit' ? 'Oprocentowanie (stałe, % rocznie)' : 'Stawka (% rocznie)'}
          </label>
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

        {assetClass === 'savings' ? (
          <div>
            <label htmlFor="holding-date" className={labelClass}>Stan na dzień</label>
            <input
              id="holding-date"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className={inputClass}
            />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="holding-open-date" className={labelClass}>Data otwarcia</label>
              <input
                id="holding-open-date"
                type="date"
                value={openDate}
                onChange={(e) => setOpenDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="holding-maturity-date" className={labelClass}>Data zapadalności</label>
              <input
                id="holding-maturity-date"
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="holding-source" className={labelClass}>Źródło</label>
          <input
            id="holding-source"
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="np. mBank, manual"
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
