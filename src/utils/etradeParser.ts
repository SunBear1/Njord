/**
 * Parses an Etrade "Gains & Losses" Excel export (.xlsx) into TaxTransaction[].
 *
 * Runs entirely in the browser — the file never leaves the device.
 * SheetJS is dynamically imported so the ~900 KB chunk is only loaded on first use.
 */

import type { TaxTransaction } from '../types/tax';

// Columns we need from the Etrade G&L export (resolved by name, not index).
const REQUIRED_COLUMNS = [
  'Record Type',
  'Symbol',
  'Date Sold',
  'Total Proceeds',
  'Adjusted Cost Basis',
] as const;

/**
 * Convert an Etrade date string "MM/DD/YYYY" to ISO "YYYY-MM-DD".
 * Returns undefined for falsy / unparseable input.
 */
export function mmddyyyyToIso(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, mm, dd, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse an Etrade "Gains & Losses" .xlsx file into TaxTransaction objects.
 *
 * @param buffer - The raw ArrayBuffer from File.arrayBuffer()
 * @returns Array of TaxTransaction with dates filled, rates set to null (auto-fetch triggers on card mount)
 * @throws Error with a Polish user-friendly message if the file format is invalid
 */
export async function parseEtradeFile(buffer: ArrayBuffer): Promise<TaxTransaction[]> {
  // Lazy-load SheetJS — only downloaded the first time user imports a file.
  const XLSX = await import('xlsx');

  const workbook = XLSX.read(buffer, { type: 'array' });
  if (!workbook.SheetNames.length) {
    throw new Error('Plik Excel jest pusty — nie znaleziono żadnego arkusza.');
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (rows.length < 2) {
    throw new Error('Plik nie zawiera danych — oczekiwano nagłówków i co najmniej jednego wiersza.');
  }

  // Build column name → index map from header row.
  const headers = rows[0] as (string | null)[];
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h != null) colMap[h.trim()] = i;
  });

  // Validate that all required columns are present.
  const missing = REQUIRED_COLUMNS.filter((col) => colMap[col] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Nieprawidłowy format pliku — brak wymaganych kolumn: ${missing.join(', ')}. ` +
        'Upewnij się, że importujesz raport „Gains & Losses" z Etrade.',
    );
  }

  const trades: TaxTransaction[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length === 0) continue;

    // Only process "Sell" rows — skip "Summary" and any other record types.
    const recordType = row[colMap['Record Type']];
    if (recordType !== 'Sell') continue;

    const planType = row[colMap['Plan Type']] as string | null;
    const isRSU = planType === 'RS';

    const saleDate = mmddyyyyToIso(row[colMap['Date Sold']]);
    if (!saleDate) continue; // skip rows without a valid sell date

    const acquisitionDate = mmddyyyyToIso(row[colMap['Date Acquired']]);
    const proceeds = Number(row[colMap['Total Proceeds']]);
    const costBasis = Number(row[colMap['Adjusted Cost Basis']]);

    if (isNaN(proceeds) || proceeds <= 0) continue; // skip invalid rows

    trades.push({
      id: crypto.randomUUID(),
      tradeType: 'sale',
      acquisitionMode: isRSU ? 'grant' : 'purchase',
      zeroCostFlag: isRSU,
      ticker: (row[colMap['Symbol']] as string) ?? undefined,
      currency: 'USD',
      saleDate,
      acquisitionDate: isRSU ? undefined : acquisitionDate,
      saleGrossAmount: proceeds,
      acquisitionCostAmount: isRSU ? undefined : (isNaN(costBasis) ? undefined : costBasis),
      exchangeRateSaleToPLN: null,
      exchangeRateAcquisitionToPLN: null,
    });
  }

  if (trades.length === 0) {
    throw new Error(
      'Nie znaleziono żadnych transakcji sprzedaży w pliku. ' +
        'Upewnij się, że importujesz raport „Gains & Losses" z Etrade zawierający kolumnę „Record Type" z wierszami „Sell".',
    );
  }

  return trades;
}
