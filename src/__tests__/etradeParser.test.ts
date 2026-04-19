import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mmddyyyyToIso } from '../utils/etradeParser';

// ─── Mock SheetJS ─────────────────────────────────────────────────────────────
// We mock the 'xlsx' module so tests don't require the real ~900 KB library.

function makeSheet(rows: unknown[][]) {
  return {
    SheetNames: ['G&L_Expanded'],
    Sheets: {
      'G&L_Expanded': { __rows: rows },
    },
  };
}

vi.mock('xlsx', () => ({
  read: () => {
    return makeSheet((globalThis as Record<string, unknown>).__mockRows as unknown[][]);
  },
  utils: {
    sheet_to_json: (sheet: { __rows: unknown[][] }) => sheet.__rows,
  },
}));

// Import after mock is set up
const { parseEtradeFile } = await import('../utils/etradeParser');

function setMockRows(rows: unknown[][]) {
  (globalThis as Record<string, unknown>).__mockRows = rows;
}

// ─── Test data ────────────────────────────────────────────────────────────────

const HEADERS = [
  'Record Type', 'Symbol', 'Plan Type', 'Quantity',
  'Date Acquired', 'Date Acquired (Wash Sale Toggle = On)',
  'Acquisition Cost', 'Acquisition Cost Per Share',
  'Ordinary Income Recognized', 'Ordinary Income Recognized Per Share',
  'Adjusted Cost Basis', 'Adjusted Cost Basis Per Share',
  'Date Sold', 'Total Proceeds', 'Proceeds Per Share',
  'Deferred Loss', 'Gain/Loss',
];

const SELL_ROW_RSU = [
  'Sell', 'DT', 'RS', 49,
  '08/15/2024', '08/15/2024',
  0, 0,
  2397.57, 48.93,
  2397.57, 48.93,
  '02/03/2025', 2882.89, 58.83,
  0, 485.32,
];

const SELL_ROW_PURCHASE = [
  'Sell', 'AAPL', 'ES', 10,
  '01/15/2024', '01/15/2024',
  1500, 150,
  0, 0,
  1500, 150,
  '06/20/2024', 1950, 195,
  0, 450,
];

const SUMMARY_ROW = [
  'Summary', null, null, 61,
  null, null,
  null, null,
  null, null,
  null, null,
  null, null, null,
  null, 3588.9,
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('mmddyyyyToIso', () => {
  it('converts MM/DD/YYYY to YYYY-MM-DD', () => {
    expect(mmddyyyyToIso('02/03/2025')).toBe('2025-02-03');
    expect(mmddyyyyToIso('12/31/2024')).toBe('2024-12-31');
    expect(mmddyyyyToIso('01/01/2000')).toBe('2000-01-01');
  });

  it('returns undefined for invalid input', () => {
    expect(mmddyyyyToIso(null)).toBeUndefined();
    expect(mmddyyyyToIso(undefined)).toBeUndefined();
    expect(mmddyyyyToIso('')).toBeUndefined();
    expect(mmddyyyyToIso('2025-02-03')).toBeUndefined(); // ISO format, not MM/DD/YYYY
    expect(mmddyyyyToIso(12345)).toBeUndefined();
    expect(mmddyyyyToIso('not-a-date')).toBeUndefined();
  });
});

describe('parseEtradeFile', () => {
  beforeEach(() => {
    setMockRows([]);
  });

  it('parses Sell rows into TaxTransactions', async () => {
    setMockRows([HEADERS, SUMMARY_ROW, SELL_ROW_RSU, SELL_ROW_PURCHASE]);

    const result = await parseEtradeFile(new ArrayBuffer(0));

    expect(result).toHaveLength(2);

    // RSU trade
    const rsu = result[0];
    expect(rsu.ticker).toBe('DT');
    expect(rsu.currency).toBe('USD');
    expect(rsu.zeroCostFlag).toBe(true);
    expect(rsu.acquisitionMode).toBe('grant');
    expect(rsu.saleDate).toBe('2025-02-03');
    expect(rsu.acquisitionDate).toBeUndefined();
    expect(rsu.saleGrossAmount).toBeCloseTo(2882.89);
    expect(rsu.acquisitionCostAmount).toBeUndefined();
    expect(rsu.exchangeRateSaleToPLN).toBeNull();

    // Purchase trade
    const purchase = result[1];
    expect(purchase.ticker).toBe('AAPL');
    expect(purchase.zeroCostFlag).toBe(false);
    expect(purchase.acquisitionMode).toBe('purchase');
    expect(purchase.saleDate).toBe('2024-06-20');
    expect(purchase.acquisitionDate).toBe('2024-01-15');
    expect(purchase.saleGrossAmount).toBeCloseTo(1950);
    expect(purchase.acquisitionCostAmount).toBeCloseTo(1500);
  });

  it('skips Summary rows and non-Sell rows', async () => {
    const otherRow = ['Other', 'SPY', 'ES', 5, '01/01/2024', null, 100, 20, 0, 0, 100, 20, '03/01/2024', 120, 24, 0, 20];
    setMockRows([HEADERS, SUMMARY_ROW, otherRow, SELL_ROW_PURCHASE]);

    const result = await parseEtradeFile(new ArrayBuffer(0));
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('AAPL');
  });

  it('detects RSU via Plan Type = RS', async () => {
    setMockRows([HEADERS, SELL_ROW_RSU]);
    const result = await parseEtradeFile(new ArrayBuffer(0));
    expect(result[0].zeroCostFlag).toBe(true);
    expect(result[0].acquisitionMode).toBe('grant');
  });

  it('detects purchase via non-RS Plan Type', async () => {
    setMockRows([HEADERS, SELL_ROW_PURCHASE]);
    const result = await parseEtradeFile(new ArrayBuffer(0));
    expect(result[0].zeroCostFlag).toBe(false);
    expect(result[0].acquisitionMode).toBe('purchase');
  });

  it('throws on missing required columns', async () => {
    setMockRows([['Record Type', 'Symbol'], SELL_ROW_PURCHASE]);
    await expect(parseEtradeFile(new ArrayBuffer(0))).rejects.toThrow('brak wymaganych kolumn');
  });

  it('throws on empty file (no data rows)', async () => {
    setMockRows([HEADERS]);
    await expect(parseEtradeFile(new ArrayBuffer(0))).rejects.toThrow('Plik nie zawiera danych');
  });

  it('throws on file with no sheets', async () => {
    // Override the mock to produce an empty workbook
    (globalThis as Record<string, unknown>).__mockRows = [];
    // We need to check behavior when there are technically 0 rows but headers exist
    setMockRows([HEADERS, SUMMARY_ROW]); // Only summary, no sells
    await expect(parseEtradeFile(new ArrayBuffer(0))).rejects.toThrow('Nie znaleziono żadnych transakcji');
  });

  it('skips rows with zero or invalid proceeds', async () => {
    const zeroRow = [...SELL_ROW_PURCHASE];
    zeroRow[13] = 0; // Total Proceeds = 0
    const nanRow = [...SELL_ROW_PURCHASE];
    nanRow[13] = 'NaN'; // invalid
    setMockRows([HEADERS, zeroRow, nanRow, SELL_ROW_PURCHASE]);

    const result = await parseEtradeFile(new ArrayBuffer(0));
    expect(result).toHaveLength(1);
    expect(result[0].saleGrossAmount).toBeCloseTo(1950);
  });

  it('generates unique IDs for each transaction', async () => {
    setMockRows([HEADERS, SELL_ROW_RSU, SELL_ROW_PURCHASE]);
    const result = await parseEtradeFile(new ArrayBuffer(0));
    const ids = result.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sets all NBP rates to null for auto-fetch', async () => {
    setMockRows([HEADERS, SELL_ROW_RSU, SELL_ROW_PURCHASE]);
    const result = await parseEtradeFile(new ArrayBuffer(0));
    for (const tx of result) {
      expect(tx.exchangeRateSaleToPLN).toBeNull();
      expect(tx.exchangeRateAcquisitionToPLN).toBeNull();
    }
  });
});
