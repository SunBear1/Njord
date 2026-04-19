/**
 * E*TRADE "Gains & Losses" parser tests.
 *
 * Two test strategies:
 * 1. Fixture file: loads src/__tests__/fixtures/etrade_gl_expanded.xlsx from disk.
 *    This is a static synthetic file that mirrors the real broker export structure
 *    exactly — same 47 columns, same row ordering, same IEEE 754 float imprecision.
 * 2. Programmatic XLSX: generates buffers on-the-fly with SheetJS for edge-case testing.
 *
 * No SheetJS mocking in either strategy — the full parsing pipeline is exercised.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as XLSX from 'xlsx';
import { mmddyyyyToIso } from '../utils/etradeParser';
import { etradeParser } from '../utils/brokerParsers/etrade';

// ─── Fixture file loader ───────────────────────────────────────────────────────

/** Load a binary fixture file and return it as an ArrayBuffer for the parser. */
function loadFixture(filename: string): ArrayBuffer {
  const nodeBuf = readFileSync(resolve(__dirname, 'fixtures', filename));
  const ab = new ArrayBuffer(nodeBuf.length);
  new Uint8Array(ab).set(nodeBuf);
  return ab;
}

// ─── Column layout (exact order from the real G&L_Expanded.xlsx file) ─────────

const ETRADE_HEADERS = [
  'Record Type', 'Symbol', 'Plan Type', 'Quantity',
  'Date Acquired', 'Date Acquired (Wash Sale Toggle = On)',
  'Acquisition Cost', 'Acquisition Cost Per Share',
  'Ordinary Income Recognized', 'Ordinary Income Recognized Per Share',
  'Adjusted Cost Basis', 'Adjusted Cost Basis Per Share',
  'Date Sold', 'Total Proceeds', 'Proceeds Per Share',
  'Deferred Loss', 'Gain/Loss', 'Gain/Loss (Wash Sale Toggle = On)',
  'Adjusted Gain/Loss', 'Adjusted Gain (Loss) Per Share',
  'Capital Gains Status', 'Wash Sale Adjusted Capital Gains Status',
  'Total Wash Sale Adjustment Amount', 'Wash Sale Adjustment Amount Per Share',
  'Total Wash Sale Adjusted Cost Basis', 'Wash Sale Adjusted Cost Basis Per Share',
  'Total Wash Sale Adjusted Gain/Loss', 'Wash Sale Adjusted Gain/Loss Per Share',
  'Order Type', 'Covered Status', 'Qualified Plan?', 'Disposition Type', 'Type',
  'Grant Date', 'Grant Date FMV', 'Discount Amount',
  'Purchase Date', 'Purchase Date Fair Mkt. Value', 'Purchase Price', 'Grant Number',
  '83(b) Election', 'Vest Date', 'Vest Date FMV',
  'Exercise Date', 'Exercise Date FMV', 'Grant Price', 'Order Number',
] as const;

/** Build a 47-element row from named column values; unspecified columns are null. */
function etradeRow(values: Partial<Record<(typeof ETRADE_HEADERS)[number], unknown>>): unknown[] {
  return ETRADE_HEADERS.map(h => (values as Record<string, unknown>)[h] ?? null);
}

/** Generate a real XLSX ArrayBuffer in E*TRADE G&L Expanded format. */
function makeEtradeBuffer(dataRows: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet([ETRADE_HEADERS as unknown as unknown[], ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'G&L_Expanded');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
}

/** Generate an XLSX with columns in a scrambled order (tests name-based lookup). */
function makeEtradeBufferShuffledColumns(dataRows: unknown[][]): ArrayBuffer {
  // Put 'Total Proceeds' first, then the rest — exercises robust column detection.
  const shuffled = [
    'Total Proceeds', 'Date Sold', 'Symbol', 'Adjusted Cost Basis',
    'Record Type', 'Plan Type', 'Date Acquired',
  ] as const;
  const shuffledRows = dataRows.map(r =>
    shuffled.map(h => r[ETRADE_HEADERS.indexOf(h)]),
  );
  const ws = XLSX.utils.aoa_to_sheet([shuffled as unknown as unknown[], ...shuffledRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'G&L_Expanded');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
}

// ─── Real file data (from G&L_Expanded.xlsx) ──────────────────────────────────

/**
 * Summary row — always row 2 in real E*TRADE exports. Parser must skip it.
 * Contains aggregate totals across all trades (no Record Type = Sell).
 */
const SUMMARY_ROW = etradeRow({
  'Record Type': 'Summary',
  'Quantity': 61,
  'Gain/Loss': 3588.900002,
});

/**
 * RSU sell #1 — exact data from G&L_Expanded.xlsx row 3.
 * DT stock, 49 shares, vest 2024-08-15, sold 2025-02-03.
 * Total Proceeds has IEEE 754 imprecision: 2882.89001 → should round to 2882.89.
 */
const RSU_SELL_DT_1 = etradeRow({
  'Record Type': 'Sell',
  'Symbol': 'DT',
  'Plan Type': 'RS',
  'Quantity': 49,
  'Date Acquired': '08/15/2024',
  'Date Acquired (Wash Sale Toggle = On)': '08/15/2024',
  'Acquisition Cost': 0,
  'Adjusted Cost Basis': 2397.57,
  'Date Sold': '02/03/2025',
  'Total Proceeds': 2882.89001,   // raw SheetJS float — must be rounded
  'Capital Gains Status': 'Short',
  'Type': 'Restricted Stock Unit',
});

/**
 * RSU sell #2 — exact data from G&L_Expanded.xlsx row 4.
 * DT stock, 12 shares, vest 2024-11-15, sold 2025-02-03.
 * Total Proceeds imprecision: 706.009992 → should round to 706.01.
 */
const RSU_SELL_DT_2 = etradeRow({
  'Record Type': 'Sell',
  'Symbol': 'DT',
  'Plan Type': 'RS',
  'Quantity': 12,
  'Date Acquired': '11/15/2024',
  'Date Acquired (Wash Sale Toggle = On)': '11/15/2024',
  'Acquisition Cost': 0,
  'Adjusted Cost Basis': 628.2,
  'Date Sold': '02/03/2025',
  'Total Proceeds': 706.009992,   // raw SheetJS float — must be rounded
  'Capital Gains Status': 'Short',
  'Type': 'Restricted Stock Unit',
});

/** Regular stock purchase (AAPL, 10 shares, acquired 2024-01-15, sold 2024-06-20). */
const REGULAR_SELL_AAPL = etradeRow({
  'Record Type': 'Sell',
  'Symbol': 'AAPL',
  'Plan Type': 'ES',
  'Quantity': 10,
  'Date Acquired': '01/15/2024',
  'Acquisition Cost': 1850,
  'Adjusted Cost Basis': 1850,
  'Date Sold': '06/20/2024',
  'Total Proceeds': 2251,
  'Capital Gains Status': 'Short',
});

/** SPY ETF purchase — another regular purchase for multi-trade tests. */
const REGULAR_SELL_SPY = etradeRow({
  'Record Type': 'Sell',
  'Symbol': 'SPY',
  'Plan Type': 'ES',
  'Quantity': 5,
  'Date Acquired': '03/10/2023',
  'Acquisition Cost': 2000,
  'Adjusted Cost Basis': 2000,
  'Date Sold': '12/31/2024',
  'Total Proceeds': 2750,
  'Capital Gains Status': 'Long',
});

// ─── mmddyyyyToIso pure function ───────────────────────────────────────────────

describe('mmddyyyyToIso', () => {
  it('converts MM/DD/YYYY to YYYY-MM-DD', () => {
    expect(mmddyyyyToIso('02/03/2025')).toBe('2025-02-03');
    expect(mmddyyyyToIso('12/31/2024')).toBe('2024-12-31');
    expect(mmddyyyyToIso('01/01/2000')).toBe('2000-01-01');
    expect(mmddyyyyToIso('08/15/2024')).toBe('2024-08-15');
    expect(mmddyyyyToIso('11/15/2024')).toBe('2024-11-15');
  });

  it('returns undefined for null/undefined/empty', () => {
    expect(mmddyyyyToIso(null)).toBeUndefined();
    expect(mmddyyyyToIso(undefined)).toBeUndefined();
    expect(mmddyyyyToIso('')).toBeUndefined();
  });

  it('returns undefined for wrong date format', () => {
    expect(mmddyyyyToIso('2025-02-03')).toBeUndefined(); // ISO format
    expect(mmddyyyyToIso('03/2025')).toBeUndefined();    // short
    expect(mmddyyyyToIso('not-a-date')).toBeUndefined();
    expect(mmddyyyyToIso('02-03-2025')).toBeUndefined(); // hyphens
  });

  it('returns undefined for non-string input', () => {
    expect(mmddyyyyToIso(12345)).toBeUndefined();
    expect(mmddyyyyToIso({ date: '02/03/2025' })).toBeUndefined();
  });
});

// ─── etradeParser.parse — real XLSX round-trip tests ──────────────────────────

describe('etradeParser.parse — real XLSX', () => {
  describe('real G&L_Expanded.xlsx data', () => {
    it('parses both RSU rows from the real file', async () => {
      const buf = makeEtradeBuffer([SUMMARY_ROW, RSU_SELL_DT_1, RSU_SELL_DT_2]);
      const result = await etradeParser.parse(buf);
      expect(result).toHaveLength(2);
    });

    it('rounds Total Proceeds 2882.89001 to 2882.89 (RSU sell #1 from real file)', async () => {
      const buf = makeEtradeBuffer([RSU_SELL_DT_1]);
      const result = await etradeParser.parse(buf);
      expect(result[0].saleGrossAmount).toBe(2882.89);
    });

    it('rounds Total Proceeds 706.009992 to 706.01 (RSU sell #2 from real file)', async () => {
      const buf = makeEtradeBuffer([RSU_SELL_DT_2]);
      const result = await etradeParser.parse(buf);
      expect(result[0].saleGrossAmount).toBe(706.01);
    });

    it('parses RSU sell #1 with all correct fields', async () => {
      const buf = makeEtradeBuffer([SUMMARY_ROW, RSU_SELL_DT_1]);
      const result = await etradeParser.parse(buf);
      const tx = result[0];

      expect(tx.ticker).toBe('DT');
      expect(tx.currency).toBe('USD');
      expect(tx.saleDate).toBe('2025-02-03');
      expect(tx.saleGrossAmount).toBe(2882.89);
      expect(tx.zeroCostFlag).toBe(true);
      expect(tx.acquisitionMode).toBe('grant');
      expect(tx.acquisitionDate).toBeUndefined(); // RSU: no acquisition date
      expect(tx.acquisitionCostAmount).toBeUndefined(); // RSU: zero cost basis
      expect(tx.exchangeRateSaleToPLN).toBeNull();
      expect(tx.exchangeRateAcquisitionToPLN).toBeNull();
      expect(tx.importSource).toBe('E*TRADE');
    });

    it('skips Summary row (row 2 in every real E*TRADE export)', async () => {
      const buf = makeEtradeBuffer([SUMMARY_ROW, RSU_SELL_DT_1]);
      const result = await etradeParser.parse(buf);
      expect(result).toHaveLength(1); // only the Sell row, not Summary
    });
  });

  describe('RSU trades (Plan Type = RS)', () => {
    it('sets zeroCostFlag = true and acquisitionMode = grant', async () => {
      const buf = makeEtradeBuffer([RSU_SELL_DT_1]);
      const result = await etradeParser.parse(buf);
      expect(result[0].zeroCostFlag).toBe(true);
      expect(result[0].acquisitionMode).toBe('grant');
    });

    it('does not set acquisitionDate (RSU: vest date not needed for NBP fetch)', async () => {
      const buf = makeEtradeBuffer([RSU_SELL_DT_1]);
      const result = await etradeParser.parse(buf);
      expect(result[0].acquisitionDate).toBeUndefined();
    });

    it('does not set acquisitionCostAmount (RSU: cost basis = 0)', async () => {
      const buf = makeEtradeBuffer([RSU_SELL_DT_1]);
      const result = await etradeParser.parse(buf);
      expect(result[0].acquisitionCostAmount).toBeUndefined();
    });
  });

  describe('regular stock purchase trades', () => {
    it('parses regular purchase with correct fields', async () => {
      const buf = makeEtradeBuffer([REGULAR_SELL_AAPL]);
      const result = await etradeParser.parse(buf);
      const tx = result[0];

      expect(tx.ticker).toBe('AAPL');
      expect(tx.zeroCostFlag).toBe(false);
      expect(tx.acquisitionMode).toBe('purchase');
      expect(tx.saleDate).toBe('2024-06-20');
      expect(tx.acquisitionDate).toBe('2024-01-15');
      expect(tx.saleGrossAmount).toBe(2251);
      expect(tx.acquisitionCostAmount).toBe(1850);
    });

    it('reads acquisitionCostAmount from Adjusted Cost Basis column', async () => {
      const buf = makeEtradeBuffer([REGULAR_SELL_AAPL]);
      const result = await etradeParser.parse(buf);
      expect(result[0].acquisitionCostAmount).toBe(1850);
    });
  });

  describe('row filtering', () => {
    it('skips Summary rows (Record Type = Summary)', async () => {
      const buf = makeEtradeBuffer([SUMMARY_ROW, REGULAR_SELL_AAPL]);
      const result = await etradeParser.parse(buf);
      expect(result).toHaveLength(1);
      expect(result[0].ticker).toBe('AAPL');
    });

    it('skips rows with Record Type other than Sell', async () => {
      const otherRow = etradeRow({
        'Record Type': 'Other',
        'Symbol': 'SPY',
        'Date Sold': '06/01/2024',
        'Total Proceeds': 500,
        'Adjusted Cost Basis': 400,
      });
      const buf = makeEtradeBuffer([otherRow, REGULAR_SELL_AAPL]);
      const result = await etradeParser.parse(buf);
      expect(result).toHaveLength(1);
      expect(result[0].ticker).toBe('AAPL');
    });

    it('parses all Sell rows in a multi-trade file', async () => {
      const buf = makeEtradeBuffer([
        SUMMARY_ROW,
        RSU_SELL_DT_1,
        RSU_SELL_DT_2,
        REGULAR_SELL_AAPL,
        REGULAR_SELL_SPY,
      ]);
      const result = await etradeParser.parse(buf);
      expect(result).toHaveLength(4);
    });

    it('skips rows with zero Total Proceeds', async () => {
      const zeroRow = etradeRow({
        'Record Type': 'Sell',
        'Symbol': 'ZERO',
        'Plan Type': 'ES',
        'Date Acquired': '01/01/2024',
        'Adjusted Cost Basis': 100,
        'Date Sold': '06/01/2024',
        'Total Proceeds': 0,
      });
      const buf = makeEtradeBuffer([zeroRow, REGULAR_SELL_AAPL]);
      const result = await etradeParser.parse(buf);
      expect(result).toHaveLength(1);
      expect(result[0].ticker).toBe('AAPL');
    });

    it('skips rows with invalid (non-numeric) Total Proceeds', async () => {
      const badRow = etradeRow({
        'Record Type': 'Sell',
        'Symbol': 'BAD',
        'Plan Type': 'ES',
        'Date Acquired': '01/01/2024',
        'Adjusted Cost Basis': 100,
        'Date Sold': '06/01/2024',
        'Total Proceeds': 'not-a-number',
      });
      const buf = makeEtradeBuffer([badRow, REGULAR_SELL_AAPL]);
      const result = await etradeParser.parse(buf);
      expect(result).toHaveLength(1);
    });

    it('skips rows without a valid Date Sold', async () => {
      const noDateRow = etradeRow({
        'Record Type': 'Sell',
        'Symbol': 'NODATE',
        'Plan Type': 'ES',
        'Total Proceeds': 1000,
        'Adjusted Cost Basis': 800,
        // Date Sold intentionally omitted
      });
      const buf = makeEtradeBuffer([noDateRow, REGULAR_SELL_AAPL]);
      const result = await etradeParser.parse(buf);
      expect(result).toHaveLength(1);
      expect(result[0].ticker).toBe('AAPL');
    });
  });

  describe('data quality', () => {
    it('generates a unique UUID for each transaction', async () => {
      const buf = makeEtradeBuffer([RSU_SELL_DT_1, RSU_SELL_DT_2, REGULAR_SELL_AAPL]);
      const result = await etradeParser.parse(buf);
      const ids = result.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('sets currency to USD for all trades', async () => {
      const buf = makeEtradeBuffer([RSU_SELL_DT_1, REGULAR_SELL_AAPL]);
      const result = await etradeParser.parse(buf);
      for (const tx of result) {
        expect(tx.currency).toBe('USD');
      }
    });

    it('sets exchangeRateSaleToPLN = null (triggers auto-fetch in TaxTransactionCard)', async () => {
      const buf = makeEtradeBuffer([RSU_SELL_DT_1, REGULAR_SELL_AAPL]);
      const result = await etradeParser.parse(buf);
      for (const tx of result) {
        expect(tx.exchangeRateSaleToPLN).toBeNull();
      }
    });

    it('sets exchangeRateAcquisitionToPLN = null', async () => {
      const buf = makeEtradeBuffer([REGULAR_SELL_AAPL]);
      const result = await etradeParser.parse(buf);
      expect(result[0].exchangeRateAcquisitionToPLN).toBeNull();
    });

    it('sets importSource to E*TRADE on every transaction', async () => {
      const buf = makeEtradeBuffer([RSU_SELL_DT_1, REGULAR_SELL_AAPL]);
      const result = await etradeParser.parse(buf);
      for (const tx of result) {
        expect(tx.importSource).toBe('E*TRADE');
      }
    });

    it('rounds Adjusted Cost Basis imprecision to 2dp', async () => {
      const impreciseRow = etradeRow({
        'Record Type': 'Sell',
        'Symbol': 'PREC',
        'Plan Type': 'ES',
        'Date Acquired': '01/01/2024',
        'Adjusted Cost Basis': 1234.56789,  // float imprecision
        'Date Sold': '06/01/2024',
        'Total Proceeds': 1500,
      });
      const buf = makeEtradeBuffer([impreciseRow]);
      const result = await etradeParser.parse(buf);
      expect(result[0].acquisitionCostAmount).toBe(1234.57);
    });
  });

  describe('column order independence', () => {
    it('parses correctly when column order is different from the real file', async () => {
      const buf = makeEtradeBufferShuffledColumns([REGULAR_SELL_AAPL]);
      const result = await etradeParser.parse(buf);
      expect(result[0].ticker).toBe('AAPL');
      expect(result[0].saleDate).toBe('2024-06-20');
      expect(result[0].saleGrossAmount).toBe(2251);
      expect(result[0].acquisitionCostAmount).toBe(1850);
    });
  });

  describe('error handling', () => {
    it('throws with Polish message when required columns are missing', async () => {
      const incompleteHeaders = ['Record Type', 'Symbol']; // missing Date Sold, Total Proceeds, etc.
      const ws = XLSX.utils.aoa_to_sheet([incompleteHeaders, ['Sell', 'AAPL']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'G&L_Expanded');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;

      await expect(etradeParser.parse(buf)).rejects.toThrow('brak wymaganych kolumn');
    });

    it('names the missing columns in the error message', async () => {
      const partialHeaders = ['Record Type', 'Symbol', 'Plan Type', 'Date Sold'];
      // Missing: Total Proceeds, Adjusted Cost Basis
      const ws = XLSX.utils.aoa_to_sheet([partialHeaders, ['Sell', 'AAPL', 'ES', '01/01/2024']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;

      await expect(etradeParser.parse(buf)).rejects.toThrow('Total Proceeds');
    });

    it('throws when no Sell rows found (only Summary rows)', async () => {
      const buf = makeEtradeBuffer([SUMMARY_ROW]);
      await expect(etradeParser.parse(buf)).rejects.toThrow('Nie znaleziono żadnych transakcji');
    });

    it('throws when all rows are non-Sell', async () => {
      const nonSellRow = etradeRow({ 'Record Type': 'Other', 'Symbol': 'X' });
      const buf = makeEtradeBuffer([SUMMARY_ROW, nonSellRow]);
      await expect(etradeParser.parse(buf)).rejects.toThrow('Nie znaleziono');
    });

    it('throws when file has only a header row (no data)', async () => {
      const ws = XLSX.utils.aoa_to_sheet([ETRADE_HEADERS as unknown as unknown[]]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'G&L_Expanded');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
      await expect(etradeParser.parse(buf)).rejects.toThrow('Plik nie zawiera danych');
    });
  });
});

// ─── Fixture file tests ────────────────────────────────────────────────────────

describe('etradeParser.parse — fixture file (etrade_gl_expanded.xlsx)', () => {
  // The fixture mirrors the real G&L_Expanded.xlsx: same 47-column layout,
  // same row ordering (Summary → RSU rows → regular purchase), same float values.

  it('loads and parses the fixture file without errors', async () => {
    const buf = loadFixture('etrade_gl_expanded.xlsx');
    await expect(etradeParser.parse(buf)).resolves.toBeDefined();
  });

  it('returns 3 transactions (2 RSU + 1 regular purchase), skipping the Summary row', async () => {
    const buf = loadFixture('etrade_gl_expanded.xlsx');
    const result = await etradeParser.parse(buf);
    expect(result).toHaveLength(3);
  });

  it('first transaction: DT RSU, sold 2025-02-03, proceeds rounded from 2882.89001', async () => {
    const buf = loadFixture('etrade_gl_expanded.xlsx');
    const result = await etradeParser.parse(buf);
    const tx = result[0];
    expect(tx.ticker).toBe('DT');
    expect(tx.zeroCostFlag).toBe(true);
    expect(tx.acquisitionMode).toBe('grant');
    expect(tx.saleDate).toBe('2025-02-03');
    expect(tx.saleGrossAmount).toBe(2882.89);
    expect(tx.acquisitionCostAmount).toBeUndefined();
    expect(tx.acquisitionDate).toBeUndefined();
    expect(tx.currency).toBe('USD');
    expect(tx.importSource).toBe('E*TRADE');
  });

  it('second transaction: DT RSU, sold 2025-02-03, proceeds rounded from 706.009992', async () => {
    const buf = loadFixture('etrade_gl_expanded.xlsx');
    const result = await etradeParser.parse(buf);
    const tx = result[1];
    expect(tx.ticker).toBe('DT');
    expect(tx.saleDate).toBe('2025-02-03');
    expect(tx.saleGrossAmount).toBe(706.01);
    expect(tx.zeroCostFlag).toBe(true);
  });

  it('third transaction: AAPL regular purchase, acquired 2024-01-15, sold 2024-06-20', async () => {
    const buf = loadFixture('etrade_gl_expanded.xlsx');
    const result = await etradeParser.parse(buf);
    const tx = result[2];
    expect(tx.ticker).toBe('AAPL');
    expect(tx.zeroCostFlag).toBe(false);
    expect(tx.acquisitionMode).toBe('purchase');
    expect(tx.acquisitionDate).toBe('2024-01-15');
    expect(tx.saleDate).toBe('2024-06-20');
    expect(tx.saleGrossAmount).toBe(2251);
    expect(tx.acquisitionCostAmount).toBe(1850);
  });

  it('all transactions have importSource = E*TRADE and null exchange rates', async () => {
    const buf = loadFixture('etrade_gl_expanded.xlsx');
    const result = await etradeParser.parse(buf);
    for (const tx of result) {
      expect(tx.importSource).toBe('E*TRADE');
      expect(tx.exchangeRateSaleToPLN).toBeNull();
      expect(tx.exchangeRateAcquisitionToPLN).toBeNull();
      expect(tx.currency).toBe('USD');
    }
  });
});
