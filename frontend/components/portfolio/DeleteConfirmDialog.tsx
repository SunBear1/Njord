import type { Position } from '../../types/position';

interface DeleteConfirmDialogProps {
  position: Position;
  onConfirm: () => void;
  onCancel: () => void;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', PLN: 'zł',
};

export function DeleteConfirmDialog({ position, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  const sym = CURRENCY_SYMBOLS[position.currency] ?? position.currency;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="bg-bg-card rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
        <h2 id="delete-title" className="text-base font-semibold text-text-primary">
          Usuń pozycję
        </h2>
        <div className="rounded-lg bg-bg-muted/40 border border-bg-muted p-3 text-sm space-y-1">
          <div className="font-mono font-semibold text-text-primary">{position.ticker}</div>
          <div className="text-text-secondary">
            {position.quantity.toLocaleString('pl-PL', { maximumFractionDigits: 4 })} szt.
            {position.avgPrice > 0 && (
              <span> · {sym}{position.avgPrice.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            )}
          </div>
          <div className="text-text-muted text-xs">{position.currency} · {position.source}</div>
        </div>
        <p className="text-sm text-text-secondary">
          Tej operacji nie można cofnąć.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-loss text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Usuń
          </button>
        </div>
      </div>
    </div>
  );
}
