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
import {
  buildColumnMap,
  detectAccountCurrency,
  excelDateToIso,
  findHeaderRowIndex,
  safeGet,
  safeNumber,
  tickerFromSymbol,
  XTB_MAX_ROWS,
} from './xtbShared';

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

  if (rows.length > XTB_MAX_ROWS + 25) { // +25 for header-search headroom
    throw new Error(
      `Plik zawiera zbyt wiele wierszy (${rows.length}). Maksymalnie dozwolone: ${XTB_MAX_ROWS}.`,
    );
  }

  // Detect account currency from the header area (before column headers).
  const accountCurrency = detectAccountCurrency(rows);

  const headerRowIdx = findHeaderRowIndex(rows);
  if (headerRowIdx === -1) {
    throw new Error(
      'Nie znaleziono wiersza nagłówkowego w pliku. ' +
        'Upewnij się, że importujesz plik Historia konta (Zamknięte pozycje) z xStation 5.',
    );
  }

  const colMap = buildColumnMap(rows[headerRowIdx] as (string | null)[]);

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
