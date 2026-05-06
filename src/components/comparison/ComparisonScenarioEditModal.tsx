import { useEffect, useState } from 'react';

interface ComparisonScenarioEditModalProps {
  isOpen: boolean;
  scenarioLabel: 'Bear' | 'Bull';
  initialStockPrice: number;
  initialFxRate: number;
  onClose: () => void;
  onSave: (stockPrice: number, fxRate: number) => void;
}

function parseDecimal(raw: string): number {
  const normalized = raw.replace(',', '.').replace(/\s+/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ComparisonScenarioEditModal({
  isOpen,
  scenarioLabel,
  initialStockPrice,
  initialFxRate,
  onClose,
  onSave,
}: ComparisonScenarioEditModalProps) {
  const [stockPriceInput, setStockPriceInput] = useState(() => initialStockPrice.toFixed(2));
  const [fxRateInput, setFxRateInput] = useState(() => initialFxRate.toFixed(4));

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const stockPrice = parseDecimal(stockPriceInput);
  const fxRate = parseDecimal(fxRateInput);
  const canSave = stockPrice > 0 && fxRate > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Edytuj scenariusz ${scenarioLabel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Edytuj scenariusz {scenarioLabel.toLowerCase()}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Podaj własne założenia dla ceny akcji i kursu USD/PLN.
          </p>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="space-y-1">
            <label htmlFor="scenario-stock-price" className="text-sm font-medium text-text-secondary">
              Cena akcji (USD)
            </label>
            <input
              id="scenario-stock-price"
              type="text"
              inputMode="decimal"
              value={stockPriceInput}
              onChange={(event) => setStockPriceInput(event.target.value)}
              className="w-full border border-border rounded-lg bg-bg-card px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="scenario-fx-rate" className="text-sm font-medium text-text-secondary">
              Kurs USD/PLN
            </label>
            <input
              id="scenario-fx-rate"
              type="text"
              inputMode="decimal"
              value={fxRateInput}
              onChange={(event) => setFxRateInput(event.target.value)}
              className="w-full border border-border rounded-lg bg-bg-card px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-muted transition-colors"
          >
            Anuluj
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return;
              onSave(stockPrice, fxRate);
              onClose();
            }}
            className="rounded-lg bg-accent-interactive px-4 py-2 text-sm font-medium text-text-on-accent hover:bg-accent-interactive/90 disabled:opacity-40 transition-colors"
          >
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}
