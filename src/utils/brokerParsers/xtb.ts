/**
 * XTB xStation 5 "Closed Position History" XLSX export parser.
 *
 * Runs entirely in the browser — the file never leaves the device.
 * SheetJS is dynamically imported so the chunk is only loaded on first use.
 *
 * Export path in xStation 5: Historia konta → Zamknięte pozycje → Eksportuj (XLSX)
 */

import type { TaxTransaction } from '../../types/tax';
import type { BrokerParser } from './types';

/**
 * Derive the ISO 4217 currency code from an XTB symbol's exchange suffix.
 * XTB appends a dot + exchange code to each symbol, e.g. AAPL.US, BMW.DE, KGHM.PL.
 */
function currencyFromSymbol(symbol: string): string {
  const dot = symbol.lastIndexOf('.');
  if (dot === -1) return 'USD';
  const suffix = symbol.slice(dot + 1).toUpperCase();
  switch (suffix) {
    case 'US':
      return 'USD';
    case 'DE':
    case 'FR':
    case 'NL':
    case 'ES':
    case 'IT':
    case 'BE':
    case 'PT':
    case 'AT':
    case 'FI':
    case 'IE':
      return 'EUR';
    case 'UK':
      return 'GBP';
    case 'PL':
      return 'PLN';
    case 'CH':
      return 'CHF';
    default:
      return 'USD';
  }
}

/** Strip exchange suffix from XTB symbol: 'AAPL.US' → 'AAPL'. */
function tickerFromSymbol(symbol: string): string {
  const dot = symbol.lastIndexOf('.');
  return dot === -1 ? symbol : symbol.slice(0, dot);
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

const REQUIRED_COLUMNS = ['Position', 'Symbol', 'Type', 'Volume', 'Open time', 'Open price', 'Close time', 'Close price'] as const;

async function parse(buffer: ArrayBuffer): Promise<TaxTransaction[]> {
  const XLSX = await import('xlsx');

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

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

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length === 0) continue;

    // Skip the "Total" summary row at the end of the sheet.
    const positionCell = row[colMap['Position']];
    if (positionCell === 'Total' || positionCell === null) continue;

    // Only process BUY (long) positions — SELL = short position, not a standard stock sale.
    const type = row[colMap['Type']];
    if (type !== 'BUY') continue;

    const saleDate = excelDateToIso(row[colMap['Close time']]);
    if (!saleDate) continue;

    const acquisitionDate = excelDateToIso(row[colMap['Open time']]);

    const volume = Number(row[colMap['Volume']]);
    const openPrice = Number(row[colMap['Open price']]);
    const closePrice = Number(row[colMap['Close price']]);

    if (isNaN(volume) || volume <= 0) continue;
    if (isNaN(closePrice) || closePrice <= 0) continue;

    const symbol = String(row[colMap['Symbol']] ?? '');
    const currency = currencyFromSymbol(symbol);
    const ticker = tickerFromSymbol(symbol);

    const saleGrossAmount = round2(volume * closePrice);
    const acquisitionCostAmount = !isNaN(openPrice) && openPrice > 0
      ? round2(volume * openPrice)
      : undefined;

    trades.push({
      id: crypto.randomUUID(),
      tradeType: 'sale',
      acquisitionMode: 'purchase',
      zeroCostFlag: false,
      ticker: ticker || undefined,
      currency,
      saleDate,
      acquisitionDate: acquisitionDate || undefined,
      saleGrossAmount,
      acquisitionCostAmount,
      exchangeRateSaleToPLN: null,
      exchangeRateAcquisitionToPLN: null,
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
    'Prowizje XTB są podane w PLN i nie są importowane — możesz je dodać ręcznie.',
  parse,
};
