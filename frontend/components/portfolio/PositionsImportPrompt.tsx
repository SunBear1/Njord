import { useState } from 'react';
import type { Position } from '../../types/position';
import type { HoldingDraft } from '../../types/holding';
import { positionToStockHoldingDraft } from '../../utils/stockHoldingAdapter';
import { resolveInstrumentType } from '../../providers/assetDataProvider';

interface PositionsImportPromptProps {
  legacyPositions: Position[];
  onImport: (draft: HoldingDraft) => Promise<void>;
  onClearLegacy: () => void;
}

export function PositionsImportPrompt({ legacyPositions, onImport, onClearLegacy }: PositionsImportPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  if (dismissed || legacyPositions.length === 0) return null;

  const remaining = legacyPositions.filter((p) => !importedIds.has(p.id));

  async function handleImport() {
    setIsImporting(true);
    setError(null);
    const results = await Promise.allSettled(
      remaining.map(async (position) => {
        const instrumentType = await resolveInstrumentType(position.ticker);
        await onImport(positionToStockHoldingDraft(position, instrumentType));
        return position.id;
      }),
    );

    const newlyImported = new Set(importedIds);
    let failureCount = 0;
    results.forEach((result) => {
      if (result.status === 'fulfilled') newlyImported.add(result.value);
      else failureCount += 1;
    });
    setImportedIds(newlyImported);
    setIsImporting(false);

    if (failureCount > 0) {
      setError(`Nie udało się zaimportować ${failureCount} z ${remaining.length} pozycji. Spróbuj ponownie.`);
      return;
    }
    onClearLegacy();
  }

  return (
    <div className="bg-bg-hover rounded-xl p-4 mb-4 border border-bg-muted">
      <p className="text-sm font-semibold text-text-primary">Znaleziono pozycje z tej przeglądarki</p>
      <p className="mt-1 text-xs text-text-secondary">
        Zapisane lokalnie pozycje można przenieść na Twoje konto, aby były dostępne z każdego urządzenia.
      </p>
      <ul className="mt-2 space-y-1">
        {remaining.map((p) => (
          <li key={p.id} className="text-xs text-text-muted">
            {p.ticker} · {p.quantity} × {p.avgPrice} {p.currency}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-loss">{error}</p>}
      <div className="mt-3 flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Odrzuć
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={isImporting}
          className="px-3 py-1.5 text-sm font-medium bg-neutral text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {isImporting ? 'Importowanie…' : `Zaimportuj ${remaining.length} ${remaining.length === 1 ? 'pozycję' : 'pozycji'} do konta`}
        </button>
      </div>
    </div>
  );
}
