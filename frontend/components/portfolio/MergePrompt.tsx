import type { PositionDraft } from '../../types/position';

interface MergePromptProps {
  draft: PositionDraft;
  onConfirm: (draft: PositionDraft) => void;
  onCancel: () => void;
}

export function MergePrompt({ draft, onConfirm, onCancel }: MergePromptProps) {
  const ticker = draft.ticker.trim().toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="bg-bg-card rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
        <h2 id="merge-title" className="text-base font-semibold text-text-primary">
          Pozycja już istnieje
        </h2>
        <p className="text-sm text-text-secondary">
          Ticker <span className="font-mono font-semibold text-text-primary">{ticker}</span> już
          jest w portfelu. Czy chcesz zastąpić ilość i cenę nabycia nowymi wartościami?
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
            onClick={() => onConfirm(draft)}
            className="px-4 py-2 text-sm font-medium bg-neutral text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Zastąp
          </button>
        </div>
      </div>
    </div>
  );
}
