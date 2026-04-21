/**
 * XTB xStation 5 "Closed Position History" XLSX export parser.
 *
 * Runs entirely in the browser — the file never leaves the device.
 * SheetJS is dynamically imported so the chunk is only loaded on first use.
 *
 * Export path in xStation 5: Historia konta → Zamknięte pozycje → Eksportuj (XLSX)
 *
 * Key design decision: XTB exports all monetary values ("Purchase value",
 * "Sale value") in the **account currency** (typically PLN for Polish users).
 * The parser reads these PLN amounts directly instead of computing
 * volume × price (which would give amounts in the instrument's native currency).
 */

import type { TaxTransaction } from '../../types/tax';
import type { BrokerParser } from './types';

/** Strip exchange suffix from XTB symbol: 'AAPL.US' → 'AAPL', 'IB01.UK' → 'IB01'. */
function tickerFromSymbol(symbol: string): string {
  const dot = symbol.lastIndexOf('.');
  return dot === -1 ? symbol : symbol.slice(0, dot);
}

/**
 * Detect the account currency from the sheet header area.
 *
 * XTB exports have a "Currency" label in the first ~15 rows (row 6 in real files).
 * The value cell is directly below or in the same row after the label.
 * Returns 'PLN' as fallback if detection fails (most Polish XTB accounts are PLN).
 */
function detectAccountCurrency(rows: unknown[][]): string {
  const KNOWN_CURRENCIES = new Set(['PLN', 'USD', 'EUR', 'GBP', 'CHF', 'CZK', 'HUF', 'RON']);
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      if (typeof row[j] === 'string' && (row[j] as string).trim() === 'Currency') {
        // Check the cell in the same column, next row
        const nextRow = rows[i + 1];
        if (nextRow && j < nextRow.length) {
          const val = String(nextRow[j] ?? '').trim().toUpperCase();
          if (KNOWN_CURRENCIES.has(val)) return val;
        }
      }
      // Also check if a cell in the header area directly contains a known currency code
      // in certain layouts where currency is in the same row
    }
  }
  return 'PLN';
}

/**
 * Convert an Excel datetime value to ISO date string 'YYYY-MM-DD'.
 * SheetJS reads Excel date cells as JavaScript Date objects when the cell
 * is formatted as a date. We extract year/month/day in UTC.
 */
function excelDateToIso(raw: unknown): string | undefined {
  if (!raw) return undefined;
  // SheetJS returns Date objects for date-typed cells
  if (raw instanceof Date) {
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const d = String(raw.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Fallback: try parsing a string date
  if (typeof raw === 'string') {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getUTCFullYear();
      const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const d = String(parsed.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return undefined;
}

const MAX_ROWS = 5_000;
const MAX_AMOUNT = 1e9;

/** Guard against prototype-pollution keys in parsed XLSX rows. */
function safeGet(row: unknown[], idx: number): unknown {
  if (idx < 0 || idx >= row.length) return undefined;
  return row[idx];
}

/** Validate a monetary/numeric amount: must be finite and within [min, max]. */
function safeNumber(raw: unknown, min = 0, max = MAX_AMOUNT): number {
  const n = Number(raw);
  if (!isFinite(n) || n < min || n > max) return NaN;
  return n;
}

const REQUIRED_COLUMNS = [
  'Position', 'Symbol', 'Type', 'Volume',
  'Open time', 'Open price', 'Close time', 'Close price',
  'Purchase value', 'Sale value',
] as const;

async function parse(buffer: ArrayBuffer): Promise<TaxTransaction[]> {
  const XLSX = await import('xlsx');

  let workbook: ReturnType<typeof XLSX.read>;
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch {
    throw new Error('Plik nie jest prawidłowym arkuszem Excel (.xlsx).');
  }

  // Find the "CLOSED POSITION HISTORY" sheet (case-insensitive prefix match).
  const sheetName = workbook.SheetNames.find((n) =>
    n.trim().toUpperCase().startsWith('CLOSED POSITION HISTORY'),
  );
  if (!sheetName) {
    throw new Error(
      'Nie znaleziono arkusza „CLOSED POSITION HISTORY". ' +
        'Upewnij się, że importujesz plik Historia konta (Zamknięte pozycje) z xStation 5.',
    );
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (rows.length > MAX_ROWS + 25) { // +25 for header-search headroom
    throw new Error(
      `Plik zawiera zbyt wiele wierszy (${rows.length}). Maksymalnie dozwolone: ${MAX_ROWS}.`,
    );
  }

  // Detect account currency from the header area (before column headers).
  const accountCurrency = detectAccountCurrency(rows);

  // Find the header row: scan up to first 25 rows for the row that contains
  // all three sentinel column names. SheetJS drops the leading empty column
  // that openpyxl sees, so 'Position' can appear at any index — we check by value.
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i] as unknown[];
    if (row.includes('Position') && row.includes('Symbol') && row.includes('Type')) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    throw new Error(
      'Nie znaleziono wiersza nagłówkowego w pliku. ' +
        'Upewnij się, że importujesz plik Historia konta (Zamknięte pozycje) z xStation 5.',
    );
  }

  const headers = rows[headerRowIdx] as (string | null)[];
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h != null && typeof h === 'string') colMap[h.trim()] = i;
  });

  const missing = REQUIRED_COLUMNS.filter((col) => colMap[col] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Nieprawidłowy format pliku — brak wymaganych kolumn: ${missing.join(', ')}. ` +
        'Upewnij się, że importujesz plik Historia konta (Zamknięte pozycje) z xStation 5.',
    );
  }

  const trades: TaxTransaction[] = [];
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const isPLN = accountCurrency === 'PLN';

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length === 0) continue;

    // Skip the "Total" summary row at the end of the sheet.
    const positionCell = safeGet(row, colMap['Position']);
    if (positionCell === 'Total' || positionCell === null) continue;

    // Only process BUY (long) positions — SELL = short position, not a standard stock sale.
    const type = safeGet(row, colMap['Type']);
    if (type !== 'BUY') continue;

    const saleDate = excelDateToIso(safeGet(row, colMap['Close time']));
    if (!saleDate) continue;

    const acquisitionDate = excelDateToIso(safeGet(row, colMap['Open time']));

    const symbol = String(safeGet(row, colMap['Symbol']) ?? '');
    const ticker = tickerFromSymbol(symbol);

    // Use "Purchase value" and "Sale value" columns — these are in the account currency.
    const saleValue = safeNumber(safeGet(row, colMap['Sale value']), 0.000001);
    const purchaseValue = safeNumber(safeGet(row, colMap['Purchase value']), 0);

    if (isNaN(saleValue) || saleValue <= 0) continue;

    const saleGrossAmount = round2(saleValue);
    const acquisitionCostAmount = !isNaN(purchaseValue) && purchaseValue > 0
      ? round2(purchaseValue)
      : undefined;

    trades.push({
      id: crypto.randomUUID(),
      tradeType: 'sale',
      acquisitionMode: 'purchase',
      zeroCostFlag: false,
      ticker: ticker || undefined,
      currency: accountCurrency,
      saleDate,
      acquisitionDate: acquisitionDate || undefined,
      saleGrossAmount,
      acquisitionCostAmount,
      // PLN account → no FX conversion needed, pre-set rate to 1.
      exchangeRateSaleToPLN: isPLN ? 1 : null,
      exchangeRateAcquisitionToPLN: isPLN ? 1 : null,
      ...(isPLN ? { rateSaleEffectiveDate: saleDate, rateAcquisitionEffectiveDate: acquisitionDate } : {}),
      importSource: 'XTB',
    });
  }

  if (trades.length === 0) {
    throw new Error(
      'Nie znaleziono żadnych pozycji długich (BUY) w pliku. ' +
        'Upewnij się, że w wybranym zakresie dat były zamknięte pozycje zakupowe.',
    );
  }

  return trades;
}

export const xtbParser: BrokerParser = {
  id: 'xtb',
  name: 'XTB',
  fileLabel: 'Historia zamkniętych pozycji (.xlsx)',
  fileAccept: '.xlsx',
  downloadInstructions: [
    'Zaloguj się do xStation 5',
    'Kliknij ikonę portfela → Historia konta',
    'Przejdź do zakładki Zamknięte pozycje',
    'Wybierz zakres dat (np. cały rok podatkowy)',
    'Kliknij Eksportuj → XLSX',
    'Zapisz plik .xlsx i wybierz go poniżej',
  ],
  formatNote:
    'Akceptujemy wyłącznie raport „Historia zamkniętych pozycji" z xStation 5 w formacie .xlsx. ' +
    'Importowane są wyłącznie pozycje długie (BUY). Pozycje krótkie (SELL/short) są pomijane. ' +
    'Kwoty importowane są w walucie konta (np. PLN) — dla kont PLN przeliczenie walutowe nie jest wymagane.',
  parse,
};
