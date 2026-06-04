import { useState } from 'react';
import type { PositionDraft, PositionValidationErrors, PositionCurrency } from '../../types/position';
import { validatePositionDraft, POSITION_CURRENCIES } from '../../types/position';

interface PositionFormProps {
  onSubmit: (draft: PositionDraft) => void;
  onCancel?: () => void;
  initialDraft?: Partial<PositionDraft>;
  submitLabel?: string;
}

const DEFAULT_DRAFT: PositionDraft = {
  ticker: '',
  quantity: '',
  avgPrice: '',
  currency: 'USD',
};

export function PositionForm({ onSubmit, onCancel, initialDraft, submitLabel = 'Dodaj' }: PositionFormProps) {
  const [draft, setDraft] = useState<PositionDraft>({ ...DEFAULT_DRAFT, ...initialDraft });
  const [errors, setErrors] = useState<PositionValidationErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof PositionDraft, boolean>>>({});

  function handleChange<K extends keyof PositionDraft>(field: K, value: PositionDraft[K]) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    if (touched[field]) {
      setErrors(validatePositionDraft(next));
    }
  }

  function handleBlur(field: keyof PositionDraft) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validatePositionDraft(draft));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const allTouched: Partial<Record<keyof PositionDraft, boolean>> = {
      ticker: true, quantity: true, avgPrice: true, currency: true,
    };
    setTouched(allTouched);
    const validationErrors = validatePositionDraft(draft);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(draft);
    setDraft(DEFAULT_DRAFT);
    setErrors({});
    setTouched({});
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ticker */}
        <div>
          <label htmlFor="pos-ticker" className="block text-sm font-medium text-text-secondary mb-1">
            Ticker
          </label>
          <input
            id="pos-ticker"
            type="text"
            value={draft.ticker}
            onChange={(e) => handleChange('ticker', e.target.value)}
            onBlur={() => handleBlur('ticker')}
            placeholder="np. AAPL, IWDA.L"
            className="w-full px-3 py-2 rounded-lg border border-bg-muted bg-bg-card text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-neutral/50 uppercase"
            aria-describedby={errors.ticker ? 'ticker-error' : undefined}
            aria-invalid={!!errors.ticker}
          />
          {errors.ticker && touched.ticker && (
            <p id="ticker-error" className="mt-1 text-xs text-loss">{errors.ticker}</p>
          )}
        </div>

        {/* Currency */}
        <div>
          <label htmlFor="pos-currency" className="block text-sm font-medium text-text-secondary mb-1">
            Waluta
          </label>
          <select
            id="pos-currency"
            value={draft.currency}
            onChange={(e) => handleChange('currency', e.target.value as PositionCurrency)}
            onBlur={() => handleBlur('currency')}
            className="w-full px-3 py-2 rounded-lg border border-bg-muted bg-bg-card text-text-primary focus:outline-none focus:ring-2 focus:ring-neutral/50"
            aria-describedby={errors.currency ? 'currency-error' : undefined}
            aria-invalid={!!errors.currency}
          >
            {POSITION_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errors.currency && touched.currency && (
            <p id="currency-error" className="mt-1 text-xs text-loss">{errors.currency}</p>
          )}
        </div>

        {/* Quantity */}
        <div>
          <label htmlFor="pos-qty" className="block text-sm font-medium text-text-secondary mb-1">
            Ilość
          </label>
          <input
            id="pos-qty"
            type="number"
            min="0.0001"
            step="any"
            value={draft.quantity}
            onChange={(e) => handleChange('quantity', e.target.value)}
            onBlur={() => handleBlur('quantity')}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg border border-bg-muted bg-bg-card text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-neutral/50"
            aria-describedby={errors.quantity ? 'qty-error' : undefined}
            aria-invalid={!!errors.quantity}
          />
          {errors.quantity && touched.quantity && (
            <p id="qty-error" className="mt-1 text-xs text-loss">{errors.quantity}</p>
          )}
        </div>

        {/* Avg Price */}
        <div>
          <label htmlFor="pos-price" className="block text-sm font-medium text-text-secondary mb-1">
            Śr. cena nabycia
          </label>
          <input
            id="pos-price"
            type="number"
            min="0"
            step="any"
            value={draft.avgPrice}
            onChange={(e) => handleChange('avgPrice', e.target.value)}
            onBlur={() => handleBlur('avgPrice')}
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-lg border border-bg-muted bg-bg-card text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-neutral/50"
            aria-describedby={errors.avgPrice ? 'price-error' : undefined}
            aria-invalid={!!errors.avgPrice}
          />
          {errors.avgPrice && touched.avgPrice && (
            <p id="price-error" className="mt-1 text-xs text-loss">{errors.avgPrice}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Anuluj
          </button>
        )}
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-neutral text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
