import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { Position } from '../../types/position';
import type { HoldingDraft } from '../../types/holding';
import { parseXtbOpenPositions } from '../../utils/brokerParsers/xtbOpenPositions';
import { findMatchingPosition } from '../../hooks/useStockPositions';
import { positionDraftToStockHoldingDraft } from '../../utils/stockHoldingAdapter';
import { resolveInstrumentType } from '../../providers/assetDataProvider';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface XtbPositionsImportProps {
  positions: Position[];
  onImport: (draft: HoldingDraft) => Promise<void>;
}

export function XtbPositionsImport({ positions, onImport }: XtbPositionsImportProps) {
  const [expanded, setExpanded] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setSummary(null);
    setIsImporting(true);
    try {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Plik jest za duży (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksymalnie 10 MB.`);
      }
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        throw new Error('Plik nie jest prawidłowym arkuszem Excel (.xlsx).');
      }
      const buffer = await file.arrayBuffer();
      const { positions: parsed, skippedShortCount } = await parseXtbOpenPositions(buffer);

      const toImport = parsed.filter((draft) => !findMatchingPosition(positions, draft));
      const duplicateCount = parsed.length - toImport.length;

      const results = await Promise.allSettled(
        toImport.map(async (draft) => {
          const instrumentType = await resolveInstrumentType(draft.ticker);
          await onImport(positionDraftToStockHoldingDraft(draft, instrumentType));
        }),
      );
      const failedCount = results.filter((r) => r.status === 'rejected').length;
      const importedCount = toImport.length - failedCount;

      const parts = [`Zaimportowano ${importedCount} z ${parsed.length} pozycji.`];
      if (duplicateCount > 0) parts.push(`${duplicateCount} pominięto (już są w portfelu).`);
      if (skippedShortCount > 0) parts.push(`${skippedShortCount} pozycji krótkich pominięto.`);
      if (failedCount > 0) parts.push(`${failedCount} nie udało się zaimportować — spróbuj ponownie.`);
      setSummary(parts.join(' '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd podczas importu.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mb-4 flex items-center gap-1.5 text-sm text-neutral hover:underline"
      >
        <Upload size={14} aria-hidden="true" />
        Zaimportuj otwarte pozycje z XTB
      </button>
    );
  }

  return (
    <div className="bg-bg-hover rounded-xl p-4 mb-4 border border-bg-muted">
      <p className="text-sm font-semibold text-text-primary">Import z XTB (xStation 5)</p>
      <ol className="mt-2 space-y-1 text-xs text-text-secondary list-decimal list-inside">
        <li>Zaloguj się do xStation 5</li>
        <li>Kliknij ikonę portfela → Historia konta</li>
        <li>Przejdź do zakładki Otwarte pozycje</li>
        <li>Kliknij Eksportuj → XLSX i wybierz plik poniżej</li>
      </ol>
      <p className="mt-2 text-xs text-text-muted">
        Waluta pozycji jest odgadywana na podstawie waluty konta — po imporcie warto ją zweryfikować.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        disabled={isImporting}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="mt-3 block w-full text-sm text-text-secondary file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-neutral file:text-white file:text-sm hover:file:opacity-90"
      />

      {isImporting && <p className="mt-2 text-xs text-text-muted">Importowanie…</p>}
      {error && <p className="mt-2 text-xs text-loss">{error}</p>}
      {summary && <p className="mt-2 text-xs text-profit">{summary}</p>}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Zamknij
        </button>
      </div>
    </div>
  );
}
