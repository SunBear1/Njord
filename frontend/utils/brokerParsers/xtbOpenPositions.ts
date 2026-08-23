/**
 * XTB xStation 5 "Open Positions" XLSX export parser — for importing current
 * stock/ETF holdings into the portfolio (as opposed to `xtb.ts`, which parses
 * *closed* position history for Belka tax reporting).
 *
 * Runs entirely in the browser — the file never leaves the device.
 *
 * Export path in xStation 5: Historia konta → Otwarte pozycje → Eksportuj (XLSX)
 *
 * BEST-EFFORT NOTE: unlike the closed-position report (whose "Purchase value"/
 * "Sale value" columns are documented as being in the account currency), XTB's
 * live open-positions view shows "Open price" in the instrument's own trading
 * currency (e.g. USD for a US stock), not the account currency. This parser
 * doesn't have a per-row currency column to read, so it falls back to the
 * detected account currency, clamped to one of the four currencies this app
 * supports (USD/EUR/GBP/PLN, defaulting unsupported ones to USD). Verify the
 * imported currency per position after import — this is the one field most
 * likely to need a manual correction until this is validated against a real
 * export file.
 */

import type { PositionDraft, PositionCurrency } from '../../types/position';
import {
  buildColumnMap,
  detectAccountCurrency,
  findHeaderRowIndex,
  safeGet,
  safeNumber,
  tickerFromSymbol,
  XTB_MAX_ROWS,
} from './xtbShared';

const REQUIRED_COLUMNS = ['Position', 'Symbol', 'Type', 'Volume', 'Open time', 'Open price'] as const;
const SUPPORTED_CURRENCIES: readonly PositionCurrency[] = ['USD', 'EUR', 'GBP', 'PLN'];

function toSupportedCurrency(detected: string): PositionCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(detected) ? (detected as PositionCurrency) : 'USD';
}

export interface XtbOpenPositionsResult {
  positions: PositionDraft[];
  skippedShortCount: number;
}

export async function parseXtbOpenPositions(buffer: ArrayBuffer): Promise<XtbOpenPositionsResult> {
  const XLSX = await import('xlsx');

  let workbook: ReturnType<typeof XLSX.read>;
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch {
    throw new Error('Plik nie jest prawidłowym arkuszem Excel (.xlsx).');
  }

  const sheetName = workbook.SheetNames.find((n) => n.trim().toUpperCase().startsWith('OPEN POSITION'));
  if (!sheetName) {
    throw new Error(
      'Nie znaleziono arkusza „OPEN POSITIONS". ' +
        'Upewnij się, że importujesz plik Historia konta (Otwarte pozycje) z xStation 5.',
    );
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (rows.length > XTB_MAX_ROWS + 25) {
    throw new Error(
      `Plik zawiera zbyt wiele wierszy (${rows.length}). Maksymalnie dozwolone: ${XTB_MAX_ROWS}.`,
    );
  }

  const accountCurrency = toSupportedCurrency(detectAccountCurrency(rows));

  const headerRowIdx = findHeaderRowIndex(rows);
  if (headerRowIdx === -1) {
    throw new Error(
      'Nie znaleziono wiersza nagłówkowego w pliku. ' +
        'Upewnij się, że importujesz plik Historia konta (Otwarte pozycje) z xStation 5.',
    );
  }

  const colMap = buildColumnMap(rows[headerRowIdx] as (string | null)[]);

  const missing = REQUIRED_COLUMNS.filter((col) => colMap[col] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Nieprawidłowy format pliku — brak wymaganych kolumn: ${missing.join(', ')}. ` +
        'Upewnij się, że importujesz plik Historia konta (Otwarte pozycje) z xStation 5.',
    );
  }

  const positions: PositionDraft[] = [];
  let skippedShortCount = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length === 0) continue;

    const positionCell = safeGet(row, colMap['Position']);
    if (positionCell === 'Total' || positionCell === null) continue;

    const type = safeGet(row, colMap['Type']);
    if (type !== 'BUY') {
      skippedShortCount += 1;
      continue;
    }

    const symbol = String(safeGet(row, colMap['Symbol']) ?? '');
    const ticker = tickerFromSymbol(symbol);
    if (!ticker) continue;

    const quantity = safeNumber(safeGet(row, colMap['Volume']), 0.000001);
    const avgPrice = safeNumber(safeGet(row, colMap['Open price']), 0.000001);
    if (isNaN(quantity) || isNaN(avgPrice)) continue;

    positions.push({
      ticker,
      quantity: String(quantity),
      avgPrice: String(avgPrice),
      currency: accountCurrency,
      source: 'XTB',
    });
  }

  if (positions.length === 0) {
    throw new Error(
      'Nie znaleziono żadnych otwartych pozycji długich (BUY) w pliku. ' +
        'Upewnij się, że eksportujesz aktualne otwarte pozycje z xStation 5.',
    );
  }

  return { positions, skippedShortCount };
}
