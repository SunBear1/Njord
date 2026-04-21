/**
 * XTB xStation 5 "Closed Position History" parser tests.
 *
 * Two test strategies:
 * 1. Fixture file: loads src/__tests__/fixtures/xtb_closed_positions.xlsx from disk.
 *    This is a static synthetic file that mirrors the real broker export structure —
 *    same sheet name with trailing space, same account-info header rows, same column
 *    layout, real-world trade data.
 * 2. Programmatic XLSX: generates buffers on-the-fly with SheetJS for edge-case testing.
 *
 * No SheetJS mocking in either strategy — the full parsing pipeline is exercised.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as XLSX from 'xlsx';
import { xtbParser } from '../utils/brokerParsers/xtb';

// ─── Fixture file loader ───────────────────────────────────────────────────────────

/** Load a binary fixture file and return it as an ArrayBuffer for the parser. */
function loadFixture(filename: string): ArrayBuffer {
  const nodeBuf = readFileSync(resolve(__dirname, 'fixtures', filename));
  const ab = new ArrayBuffer(nodeBuf.length);
  new Uint8Array(ab).set(nodeBuf);
  return ab;
}

// ─── Column layout (exact order from real XTB Closed Position History export) ─

const XTB_HEADERS = [
  'Position', 'Symbol', 'Type', 'Volume',
  'Open time', 'Open price', 'Close time', 'Close price',
  'Open origin', 'Close origin', 'Purchase value', 'Sale value',
  'SL', 'TP', 'Margin', 'Commission', 'Swap', 'Rollover', 'Gross P/L', 'Comment',
] as const;

/** Build a 20-element XTB row from named column values; unspecified columns are null. */
function xtbRow(values: Partial<Record<(typeof XTB_HEADERS)[number], unknown>>): unknown[] {
  return XTB_HEADERS.map(h => (values as Record<string, unknown>)[h] ?? null);
}

/** Total/summary row that always terminates the data section in real XTB exports. */
const XTB_TOTAL_ROW = xtbRow({ 'Position': 'Total', 'Commission': 0, 'Swap': 0, 'Rollover': 0, 'Gross P/L': 0 });

/**
 * Account info header rows that include the Currency field.
 * Mirrors the real XTB export where row 6 has labels and row 7 has values.
 */
const ACCOUNT_HEADER_PLN: unknown[][] = [
  [null, null, null, null, 'Name and surname', null, null, 'Account', null, null, 'Currency', null, null, null, null, null, null, null, null, null],
  [null, null, null, null, 'Test User', null, null, '12345678', null, null, 'PLN', null, null, null, null, null, null, null, null, null],
];

const ACCOUNT_HEADER_USD: unknown[][] = [
  [null, null, null, null, 'Name and surname', null, null, 'Account', null, null, 'Currency', null, null, null, null, null, null, null, null, null],
  [null, null, null, null, 'Test User', null, null, '12345678', null, null, 'USD', null, null, null, null, null, null, null, null, null],
];

/**
 * Generate a real XLSX ArrayBuffer in XTB Closed Position History format.
 *
 * @param dataRows  Position rows between the header and the Total row.
 * @param options.leadingRows  Rows to prepend before the header row.
 * @param options.sheetName    Name of the Excel sheet (default: 'CLOSED POSITION HISTORY').
 */
function makeXtbBuffer(
  dataRows: unknown[][],
  {
    leadingRows = [] as unknown[][],
    sheetName = 'CLOSED POSITION HISTORY',
  } = {},
): ArrayBuffer {
  const allRows = [
    ...leadingRows,
    XTB_HEADERS as unknown as unknown[],
    ...dataRows,
    XTB_TOTAL_ROW,
  ];
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
}

// ─── Real file data (from account_51723721_pl_xlsx_2005-12-31_2026-04-19.xlsx) ─

/**
 * Real trade: IB01.UK (UK gilt ETF), 2 units, PLN account.
 * Open  2025-08-26 at GBP 117.12 → Purchase value = 863.90 PLN
 * Close 2025-11-05 at GBP 118.10 → Sale value     = 871.15 PLN
 * Gross P/L = 7.25 PLN.
 */
const REAL_IB01_BUY = xtbRow({
  'Position': 1990456723,
  'Symbol': 'IB01.UK',
  'Type': 'BUY',
  'Volume': 2,
  'Open time': new Date(Date.UTC(2025, 7, 26, 9, 0, 5)),   // 2025-08-26
  'Open price': 117.12,
  'Close time': new Date(Date.UTC(2025, 10, 5, 9, 0, 28)), // 2025-11-05
  'Close price': 118.1,
  'Open origin': 'xStation Mobile iOS',
  'Close origin': 'xStation 5',
  'Purchase value': 863.9,
  'Sale value': 871.15,
  'Commission': 0,
  'Swap': 0,
  'Rollover': 0,
  'Gross P/L': 7.25,
});

// ─── Synthetic test trades ─────────────────────────────────────────────────────

/** AAPL.US — US stock. Purchase value 7500 PLN, Sale value 9000 PLN. */
const BUY_AAPL_US = xtbRow({
  'Position': 1234567890,
  'Symbol': 'AAPL.US',
  'Type': 'BUY',
  'Volume': 10,
  'Open time': new Date(Date.UTC(2024, 0, 15, 9, 0, 0)),   // 2024-01-15
  'Open price': 185.50,
  'Close time': new Date(Date.UTC(2024, 5, 20, 9, 0, 0)),  // 2024-06-20
  'Close price': 225.10,
  'Open origin': 'xStation 5',
  'Close origin': 'xStation 5',
  'Purchase value': 7500.00,
  'Sale value': 9000.00,
  'Commission': 0,
  'Swap': 0,
  'Rollover': 0,
  'Gross P/L': 1500.00,
});

/** BMW.DE — German stock. Purchase value 2000 PLN, Sale value 2150 PLN. */
const BUY_BMW_DE = xtbRow({
  'Position': 9876543210,
  'Symbol': 'BMW.DE',
  'Type': 'BUY',
  'Volume': 5,
  'Open time': new Date(Date.UTC(2024, 2, 10, 10, 0, 0)),  // 2024-03-10
  'Open price': 92.40,
  'Close time': new Date(Date.UTC(2024, 8, 15, 15, 0, 0)), // 2024-09-15
  'Close price': 98.80,
  'Open origin': 'xStation 5',
  'Close origin': 'xStation 5',
  'Purchase value': 2000.00,
  'Sale value': 2150.00,
  'Commission': 0,
  'Swap': 0,
  'Rollover': 0,
  'Gross P/L': 150.00,
});

/** TSLA.US SELL (short position) — must be skipped by the parser. */
const SELL_TSLA_SHORT = xtbRow({
  'Position': 1111111111,
  'Symbol': 'TSLA.US',
  'Type': 'SELL',
  'Volume': 2,
  'Open time': new Date(Date.UTC(2024, 1, 1, 9, 0, 0)),
  'Open price': 200.00,
  'Close time': new Date(Date.UTC(2024, 1, 10, 15, 0, 0)),
  'Close price': 180.00,
  'Purchase value': 1600,
  'Sale value': 1440,
  'Commission': 0,
  'Swap': 0,
  'Rollover': 0,
  'Gross P/L': 40.00,
});

// ─── Real XTB account-info header rows (rows 6–12 in the real export) ─────────────────

const REALISTIC_LEADING_ROWS: unknown[][] = [
  ...ACCOUNT_HEADER_PLN,
  [null, null, null, null, 'Balance', null, null, 'Equity', null, null, 'Margin', null, null, 'Free margin', null, null, 'Margin level', null, null, null],
  [null, null, null, null, 5.10, null, null, 255.25, null, null, 0, null, null, 5.10, null, null, 0, null, null, null],
  ['CLOSED POSITION HISTORY ', null, null, null, null, null, '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['01/01/2025 - 31/12/2025', null, null, null, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['Balance :5.10 - 0.00', null, null, null, null, null, '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
];

// ─── Tests ────────────────────────────────────────────────────────────────────────

describe('xtbParser.parse — real XLSX', () => {
  describe('real XTB account file data (IB01.UK PLN account)', () => {
    it('parses the IB01.UK BUY position from the real file', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY], { leadingRows: REALISTIC_LEADING_ROWS });
      const result = await xtbParser.parse(buf);
      expect(result).toHaveLength(1);
    });

    it('strips .UK suffix from ticker and uses account currency PLN', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY], { leadingRows: REALISTIC_LEADING_ROWS });
      const [tx] = await xtbParser.parse(buf);
      expect(tx.ticker).toBe('IB01');
      expect(tx.currency).toBe('PLN');
    });

    it('uses Purchase value / Sale value columns (PLN amounts from XTB)', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY], { leadingRows: REALISTIC_LEADING_ROWS });
      const [tx] = await xtbParser.parse(buf);
      expect(tx.acquisitionCostAmount).toBe(863.90); // Purchase value in PLN
      expect(tx.saleGrossAmount).toBe(871.15);       // Sale value in PLN
    });

    it('P/L matches: 871.15 - 863.90 = 7.25 PLN', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY], { leadingRows: REALISTIC_LEADING_ROWS });
      const [tx] = await xtbParser.parse(buf);
      const pl = tx.saleGrossAmount - (tx.acquisitionCostAmount ?? 0);
      expect(pl).toBeCloseTo(7.25, 2);
    });

    it('pre-sets exchange rates to 1 for PLN account (no NBP fetch needed)', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY], { leadingRows: REALISTIC_LEADING_ROWS });
      const [tx] = await xtbParser.parse(buf);
      expect(tx.exchangeRateSaleToPLN).toBe(1);
      expect(tx.exchangeRateAcquisitionToPLN).toBe(1);
    });

    it('parses open date as 2025-08-26', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY], { leadingRows: REALISTIC_LEADING_ROWS });
      const [tx] = await xtbParser.parse(buf);
      expect(tx.acquisitionDate).toBe('2025-08-26');
    });

    it('parses close date as 2025-11-05', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY], { leadingRows: REALISTIC_LEADING_ROWS });
      const [tx] = await xtbParser.parse(buf);
      expect(tx.saleDate).toBe('2025-11-05');
    });
  });

  describe('account currency detection', () => {
    it('detects PLN from account header rows', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY], { leadingRows: REALISTIC_LEADING_ROWS });
      const [tx] = await xtbParser.parse(buf);
      expect(tx.currency).toBe('PLN');
      expect(tx.exchangeRateSaleToPLN).toBe(1);
    });

    it('detects USD from account header rows', async () => {
      const leadingRows = [
        ...ACCOUNT_HEADER_USD,
        ['CLOSED POSITION HISTORY ', null, null, null, null, null, '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ];
      const buf = makeXtbBuffer([REAL_IB01_BUY], { leadingRows });
      const [tx] = await xtbParser.parse(buf);
      expect(tx.currency).toBe('USD');
      expect(tx.exchangeRateSaleToPLN).toBeNull(); // USD needs NBP rate
    });

    it('defaults to PLN when no Currency header is found', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY]); // no leading rows
      const [tx] = await xtbParser.parse(buf);
      expect(tx.currency).toBe('PLN');
      expect(tx.exchangeRateSaleToPLN).toBe(1);
    });
  });

  describe('position types', () => {
    it('parses BUY (long) positions', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const result = await xtbParser.parse(buf);
      expect(result).toHaveLength(1);
      expect(result[0].ticker).toBe('AAPL');
    });

    it('skips SELL (short) positions entirely', async () => {
      const buf = makeXtbBuffer([SELL_TSLA_SHORT, BUY_AAPL_US]);
      const result = await xtbParser.parse(buf);
      expect(result).toHaveLength(1);
      expect(result[0].ticker).toBe('AAPL');
    });

    it('skips the Total summary row at end of sheet', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const result = await xtbParser.parse(buf);
      expect(result).toHaveLength(1);
    });

    it('parses multiple BUY positions in order', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US, BUY_BMW_DE, SELL_TSLA_SHORT]);
      const result = await xtbParser.parse(buf);
      expect(result).toHaveLength(2);
      expect(result[0].ticker).toBe('AAPL');
      expect(result[1].ticker).toBe('BMW');
    });
  });

  describe('ticker extraction from symbol', () => {
    const tickerCases: Array<[string, string]> = [
      ['AAPL.US', 'AAPL'],
      ['BMW.DE', 'BMW'],
      ['IB01.UK', 'IB01'],
      ['PKN.PL', 'PKN'],
      ['NESN.CH', 'NESN'],
      ['NOSUFFIX', 'NOSUFFIX'],
    ];

    tickerCases.forEach(([symbol, expectedTicker]) => {
      it(`extracts ticker from ${symbol} → ${expectedTicker}`, async () => {
        const row = xtbRow({
          'Position': 123,
          'Symbol': symbol,
          'Type': 'BUY',
          'Volume': 1,
          'Open time': new Date(Date.UTC(2024, 0, 1, 9, 0, 0)),
          'Open price': 100,
          'Close time': new Date(Date.UTC(2024, 6, 1, 9, 0, 0)),
          'Close price': 110,
          'Purchase value': 500,
          'Sale value': 550,
          'Commission': 0, 'Swap': 0, 'Rollover': 0, 'Gross P/L': 50,
        });
        const buf = makeXtbBuffer([row]);
        const result = await xtbParser.parse(buf);
        expect(result[0].ticker).toBe(expectedTicker);
      });
    });
  });

  describe('amount calculation from Purchase/Sale value columns', () => {
    it('uses Sale value column for saleGrossAmount', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.saleGrossAmount).toBe(9000.00);
    });

    it('uses Purchase value column for acquisitionCostAmount', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.acquisitionCostAmount).toBe(7500.00);
    });

    it('rounds amounts to 2 decimal places', async () => {
      const row = xtbRow({
        'Position': 999, 'Symbol': 'TEST.US', 'Type': 'BUY',
        'Volume': 3,
        'Open time': new Date(Date.UTC(2024, 0, 1, 9, 0, 0)), 'Open price': 100,
        'Close time': new Date(Date.UTC(2024, 6, 1, 9, 0, 0)), 'Close price': 110,
        'Purchase value': 1234.567,
        'Sale value': 2345.678,
        'Commission': 0, 'Swap': 0, 'Rollover': 0, 'Gross P/L': 0,
      });
      const buf = makeXtbBuffer([row]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.saleGrossAmount).toBe(2345.68);
      expect(tx.acquisitionCostAmount).toBe(1234.57);
    });

    it('skips rows where Sale value is missing or zero', async () => {
      const noSaleValue = xtbRow({
        'Position': 998, 'Symbol': 'BAD.US', 'Type': 'BUY',
        'Volume': 1,
        'Open time': new Date(Date.UTC(2024, 0, 1, 9, 0, 0)), 'Open price': 100,
        'Close time': new Date(Date.UTC(2024, 6, 1, 9, 0, 0)), 'Close price': 110,
        'Purchase value': 400,
        // Sale value is null (default)
        'Commission': 0, 'Swap': 0, 'Rollover': 0, 'Gross P/L': 10,
      });
      const buf = makeXtbBuffer([noSaleValue, BUY_AAPL_US]);
      const result = await xtbParser.parse(buf);
      expect(result).toHaveLength(1);
      expect(result[0].ticker).toBe('AAPL');
    });
  });

  describe('date handling', () => {
    it('extracts UTC date from ISO string returned by SheetJS', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.acquisitionDate).toBe('2024-01-15');
      expect(tx.saleDate).toBe('2024-06-20');
    });

    it('uses UTC date to avoid timezone off-by-one', async () => {
      const row = xtbRow({
        'Position': 1, 'Symbol': 'SPY.US', 'Type': 'BUY', 'Volume': 1,
        'Open time': new Date(Date.UTC(2024, 11, 31, 9, 0, 0)),  // 2024-12-31
        'Open price': 500,
        'Close time': new Date(Date.UTC(2025, 0, 2, 9, 0, 0)),   // 2025-01-02
        'Close price': 510,
        'Purchase value': 2000,
        'Sale value': 2040,
        'Commission': 0, 'Swap': 0, 'Rollover': 0, 'Gross P/L': 40,
      });
      const buf = makeXtbBuffer([row]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.acquisitionDate).toBe('2024-12-31');
      expect(tx.saleDate).toBe('2025-01-02');
    });

    it('skips rows where close date is missing or invalid', async () => {
      const noCloseRow = xtbRow({
        'Position': 2, 'Symbol': 'BAD.US', 'Type': 'BUY', 'Volume': 1,
        'Open time': new Date(Date.UTC(2024, 0, 1, 9, 0, 0)), 'Open price': 100,
        'Close price': 110,
        'Purchase value': 400, 'Sale value': 440,
        'Commission': 0, 'Swap': 0, 'Rollover': 0, 'Gross P/L': 10,
      });
      const buf = makeXtbBuffer([noCloseRow, BUY_AAPL_US]);
      const result = await xtbParser.parse(buf);
      expect(result).toHaveLength(1);
      expect(result[0].ticker).toBe('AAPL');
    });
  });

  describe('header detection', () => {
    it('finds header at row 0 (minimal format without preceding rows)', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const result = await xtbParser.parse(buf);
      expect(result[0].ticker).toBe('AAPL');
    });

    it('finds header after leading account-info rows (realistic XTB format)', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US], { leadingRows: REALISTIC_LEADING_ROWS });
      const result = await xtbParser.parse(buf);
      expect(result[0].ticker).toBe('AAPL');
    });

    it('finds header when it appears after multiple leading rows', async () => {
      const manyLeadingRows = Array.from({ length: 10 }, (_, i) => [
        `Section ${i}`, null, null, null, null,
      ]);
      const buf = makeXtbBuffer([BUY_AAPL_US], { leadingRows: manyLeadingRows });
      const result = await xtbParser.parse(buf);
      expect(result[0].ticker).toBe('AAPL');
    });

    it('handles sheet name with trailing space (as in real XTB export)', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US], { sheetName: 'CLOSED POSITION HISTORY ' });
      const result = await xtbParser.parse(buf);
      expect(result[0].ticker).toBe('AAPL');
    });
  });

  describe('transaction metadata', () => {
    it('sets importSource to XTB on every transaction', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US, BUY_BMW_DE]);
      const result = await xtbParser.parse(buf);
      for (const tx of result) {
        expect(tx.importSource).toBe('XTB');
      }
    });

    it('sets acquisitionMode to purchase', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.acquisitionMode).toBe('purchase');
    });

    it('sets zeroCostFlag to false (XTB positions always have a cost)', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.zeroCostFlag).toBe(false);
    });

    it('PLN account: pre-sets exchange rates to 1', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US], { leadingRows: REALISTIC_LEADING_ROWS });
      const [tx] = await xtbParser.parse(buf);
      expect(tx.exchangeRateSaleToPLN).toBe(1);
      expect(tx.exchangeRateAcquisitionToPLN).toBe(1);
    });

    it('non-PLN account: sets exchange rates to null (triggers auto-fetch)', async () => {
      const leadingRows = [
        ...ACCOUNT_HEADER_USD,
        ['CLOSED POSITION HISTORY ', null, null, null, null, null, '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ];
      const buf = makeXtbBuffer([BUY_AAPL_US], { leadingRows });
      const [tx] = await xtbParser.parse(buf);
      expect(tx.exchangeRateSaleToPLN).toBeNull();
      expect(tx.exchangeRateAcquisitionToPLN).toBeNull();
    });

    it('generates unique UUIDs for each transaction', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US, BUY_BMW_DE, REAL_IB01_BUY]);
      const result = await xtbParser.parse(buf);
      const ids = result.map(t => t.id);
      expect(new Set(ids).size).toBe(3);
      expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('error handling', () => {
    it('throws when CLOSED POSITION HISTORY sheet is not found', async () => {
      const ws = XLSX.utils.aoa_to_sheet([[...XTB_HEADERS], ['Total', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 0, 0, 0, 0, '']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'WRONG SHEET NAME');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
      await expect(xtbParser.parse(buf)).rejects.toThrow('CLOSED POSITION HISTORY');
    });

    it('throws with Polish message on wrong sheet name', async () => {
      const ws = XLSX.utils.aoa_to_sheet([['A', 'B'], [1, 2]]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
      await expect(xtbParser.parse(buf)).rejects.toThrow('Nie znaleziono arkusza');
    });

    it('throws when the header row is not found within 25 rows', async () => {
      const manyLeadingRows = Array.from({ length: 30 }, (_, i) => [`Row ${i}`, null]);
      const ws = XLSX.utils.aoa_to_sheet([
        ...manyLeadingRows,
        [...XTB_HEADERS],
        [...BUY_AAPL_US],
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CLOSED POSITION HISTORY');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
      await expect(xtbParser.parse(buf)).rejects.toThrow('Nie znaleziono wiersza nag\u0142\u00f3wkowego');
    });

    it('throws when required columns are missing', async () => {
      const incompleteHeader = ['Position', 'Symbol', 'Type'];
      const ws = XLSX.utils.aoa_to_sheet([[...incompleteHeader], [1, 'AAPL.US', 'BUY']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CLOSED POSITION HISTORY');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
      await expect(xtbParser.parse(buf)).rejects.toThrow('brak wymaganych kolumn');
    });

    it('throws when no BUY positions found (only SELL short positions)', async () => {
      const buf = makeXtbBuffer([SELL_TSLA_SHORT]);
      await expect(xtbParser.parse(buf)).rejects.toThrow('Nie znaleziono żadnych pozycji');
    });

    it('throws when file has only Total row (no trades at all)', async () => {
      const buf = makeXtbBuffer([]); // no data rows, just header + Total
      await expect(xtbParser.parse(buf)).rejects.toThrow('Nie znaleziono');
    });
  });
});

// ─── Fixture file tests ────────────────────────────────────────────────────────────

describe('xtbParser.parse — fixture file (xtb_closed_positions.xlsx)', () => {
  // The fixture mirrors the real XTB Closed Position History export:
  //   - Sheet name "CLOSED POSITION HISTORY " (trailing space, as in real exports)
  //   - Rows 1-5 empty (dropped by SheetJS on write/read)
  //   - Rows 6-9: account info (Name and surname, Account, Balance, Equity)
  //   - Rows 10-12: section header (title, date range, balance line)
  //   - Row 13: column headers
  //   - Rows 14-16: 3 BUY positions (IB01.UK, AAPL.US, BMW.DE)
  //   - Row 17: TSLA.US SELL short (must be skipped)
  //   - Row 18: Total

  it('loads and parses the fixture file without errors', async () => {
    const buf = loadFixture('xtb_closed_positions.xlsx');
    await expect(xtbParser.parse(buf)).resolves.toBeDefined();
  });

  it('returns 3 transactions — skips SELL short and Total row', async () => {
    const buf = loadFixture('xtb_closed_positions.xlsx');
    const result = await xtbParser.parse(buf);
    expect(result).toHaveLength(3);
  });

  it('first transaction: IB01.UK BUY (PLN amounts from Purchase/Sale value)', async () => {
    const buf = loadFixture('xtb_closed_positions.xlsx');
    const result = await xtbParser.parse(buf);
    const tx = result[0];
    expect(tx.ticker).toBe('IB01');
    expect(tx.currency).toBe('PLN');
    expect(tx.saleDate).toBe('2025-11-05');
    expect(tx.acquisitionDate).toBe('2025-08-26');
    expect(tx.saleGrossAmount).toBe(871.15);       // Sale value in PLN
    expect(tx.acquisitionCostAmount).toBe(863.90);  // Purchase value in PLN
    expect(tx.importSource).toBe('XTB');
  });

  it('second transaction: AAPL.US BUY', async () => {
    const buf = loadFixture('xtb_closed_positions.xlsx');
    const result = await xtbParser.parse(buf);
    const tx = result[1];
    expect(tx.ticker).toBe('AAPL');
    expect(tx.currency).toBe('PLN');
    expect(tx.saleDate).toBe('2025-06-20');
    expect(tx.acquisitionDate).toBe('2025-01-15');
    expect(tx.saleGrossAmount).toBe(9000.00);
    expect(tx.acquisitionCostAmount).toBe(7500.00);
  });

  it('third transaction: BMW.DE BUY', async () => {
    const buf = loadFixture('xtb_closed_positions.xlsx');
    const result = await xtbParser.parse(buf);
    const tx = result[2];
    expect(tx.ticker).toBe('BMW');
    expect(tx.currency).toBe('PLN');
    expect(tx.saleDate).toBe('2025-09-15');
    expect(tx.acquisitionDate).toBe('2025-03-10');
    expect(tx.saleGrossAmount).toBe(2150.00);
    expect(tx.acquisitionCostAmount).toBe(2000.00);
  });

  it('finds header row after realistic account-info rows (row 13 in fixture)', async () => {
    const buf = loadFixture('xtb_closed_positions.xlsx');
    const result = await xtbParser.parse(buf);
    expect(result.length).toBeGreaterThan(0);
  });

  it('all transactions have importSource = XTB and PLN exchange rates = 1', async () => {
    const buf = loadFixture('xtb_closed_positions.xlsx');
    const result = await xtbParser.parse(buf);
    for (const tx of result) {
      expect(tx.importSource).toBe('XTB');
      expect(tx.exchangeRateSaleToPLN).toBe(1);
      expect(tx.exchangeRateAcquisitionToPLN).toBe(1);
      expect(tx.zeroCostFlag).toBe(false);
      expect(tx.acquisitionMode).toBe('purchase');
    }
  });
});
