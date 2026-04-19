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

// ─── Fixture file loader ───────────────────────────────────────────────────────

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
 * Generate a real XLSX ArrayBuffer in XTB Closed Position History format.
 *
 * @param dataRows  Position rows between the header and the Total row.
 * @param options.leadingRows  Rows to prepend before the header row.
 *                             Used to simulate the account-info header section
 *                             present in real XTB exports.
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
 * Real trade: IB01.UK (UK gilt ETF), 2 units.
 * Open  2025-08-26 at GBP 117.12 → acquisition cost = 2 × 117.12 = 234.24 GBP
 * Close 2025-11-05 at GBP 118.10 → sale gross       = 2 × 118.10 = 236.20 GBP
 * Gross P/L = 7.25 (as shown in real file; slight difference due to GBP/PLN conversion).
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

/** AAPL.US — US stock (USD). 10 shares: buy $185.50, sell $225.10. */
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
  'Purchase value': 1855.00,
  'Sale value': 2251.00,
  'Commission': 0,
  'Swap': 0,
  'Rollover': 0,
  'Gross P/L': 396.00,
});

/** BMW.DE — German stock (EUR). 5 shares: buy €92.40, sell €98.80. */
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
  'Purchase value': 462.00,
  'Sale value': 494.00,
  'Commission': 0,
  'Swap': 0,
  'Rollover': 0,
  'Gross P/L': 32.00,
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
  'Commission': 0,
  'Swap': 0,
  'Rollover': 0,
  'Gross P/L': 40.00,
});

// ─── Real XTB account-info header rows (rows 6–12 in the real export) ─────────
//
// The real XTB export has several rows before the column headers:
//   rows 1–5:  empty (dropped by SheetJS when writing synthetic XLSX)
//   row 6:     "Name and surname", account number, currency, timestamp
//   rows 7–9:  balance/equity/margin data
//   row 10:    "CLOSED POSITION HISTORY" section title
//   row 11:    date range
//   row 12:    balance
//   row 13:    column headers  ← parser must find this
//
// We reproduce rows 10–12 as they have string content at col A and will
// survive the XLSX round-trip.

const REALISTIC_LEADING_ROWS: unknown[][] = [
  ['CLOSED POSITION HISTORY ', null, null, null, null, null, '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['01/01/2025 - 31/12/2025', null, null, null, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['Balance :5.10 - 0.00', null, null, null, null, null, '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('xtbParser.parse — real XLSX', () => {
  describe('real XTB account file data (IB01.UK)', () => {
    it('parses the IB01.UK BUY position from the real file', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY]);
      const result = await xtbParser.parse(buf);
      expect(result).toHaveLength(1);
    });

    it('strips .UK suffix and maps to GBP currency', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.ticker).toBe('IB01');
      expect(tx.currency).toBe('GBP');
    });

    it('calculates exact amounts from real file (vol=2, open=117.12, close=118.1)', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.acquisitionCostAmount).toBe(234.24); // 2 × 117.12
      expect(tx.saleGrossAmount).toBe(236.20);       // 2 × 118.10
    });

    it('parses open date as 2025-08-26', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.acquisitionDate).toBe('2025-08-26');
    });

    it('parses close date as 2025-11-05', async () => {
      const buf = makeXtbBuffer([REAL_IB01_BUY]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.saleDate).toBe('2025-11-05');
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
      // Total row is always appended by makeXtbBuffer; ensure it is not parsed
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const result = await xtbParser.parse(buf);
      expect(result).toHaveLength(1); // not 2
    });

    it('parses multiple BUY positions in order', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US, BUY_BMW_DE, SELL_TSLA_SHORT]);
      const result = await xtbParser.parse(buf);
      expect(result).toHaveLength(2);
      expect(result[0].ticker).toBe('AAPL');
      expect(result[1].ticker).toBe('BMW');
    });
  });

  describe('currency detection from exchange suffix', () => {
    const currencyCases: Array<[string, string]> = [
      ['AAPL.US', 'USD'],
      ['BMW.DE', 'EUR'],
      ['BNP.FR', 'EUR'],
      ['ASML.NL', 'EUR'],
      ['IBE.ES', 'EUR'],
      ['ENEL.IT', 'EUR'],
      ['UCB.BE', 'EUR'],
      ['EDP.PT', 'EUR'],
      ['AMS.AT', 'EUR'],
      ['FORTUM.FI', 'EUR'],
      ['CRH.IE', 'EUR'],
      ['HSBA.UK', 'GBP'],
      ['PKN.PL', 'PLN'],
      ['NESN.CH', 'CHF'],
      ['UNKNOWN.XY', 'USD'], // unknown suffix → USD fallback
      ['NOSUFFIX', 'USD'],   // no dot → USD fallback
    ];

    currencyCases.forEach(([symbol, expectedCurrency]) => {
      it(`maps ${symbol} → ${expectedCurrency}`, async () => {
        const row = xtbRow({
          'Position': 123,
          'Symbol': symbol,
          'Type': 'BUY',
          'Volume': 1,
          'Open time': new Date(Date.UTC(2024, 0, 1, 9, 0, 0)),
          'Open price': 100,
          'Close time': new Date(Date.UTC(2024, 6, 1, 9, 0, 0)),
          'Close price': 110,
          'Commission': 0, 'Swap': 0, 'Rollover': 0, 'Gross P/L': 10,
        });
        const buf = makeXtbBuffer([row]);
        const result = await xtbParser.parse(buf);
        expect(result[0].currency).toBe(expectedCurrency);
      });
    });
  });

  describe('ticker and amount calculation', () => {
    it('strips exchange suffix from ticker (AAPL.US → AAPL)', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.ticker).toBe('AAPL');
    });

    it('strips suffix with multiple dots correctly (last dot wins)', async () => {
      const row = xtbRow({
        'Position': 1, 'Symbol': 'IB01.UK', 'Type': 'BUY', 'Volume': 1,
        'Open time': new Date(Date.UTC(2024, 0, 1, 9, 0, 0)), 'Open price': 100,
        'Close time': new Date(Date.UTC(2024, 6, 1, 9, 0, 0)), 'Close price': 110,
        'Commission': 0, 'Swap': 0, 'Rollover': 0, 'Gross P/L': 10,
      });
      const buf = makeXtbBuffer([row]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.ticker).toBe('IB01');
    });

    it('calculates saleGrossAmount as volume × close price', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.saleGrossAmount).toBe(10 * 225.10); // 2251.00
    });

    it('calculates acquisitionCostAmount as volume × open price', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.acquisitionCostAmount).toBe(10 * 185.50); // 1855.00
    });

    it('rounds float imprecision in saleGrossAmount to 2dp', async () => {
      const impreciseRow = xtbRow({
        'Position': 999, 'Symbol': 'TEST.US', 'Type': 'BUY',
        'Volume': 3,
        'Open time': new Date(Date.UTC(2024, 0, 1, 9, 0, 0)), 'Open price': 100,
        'Close time': new Date(Date.UTC(2024, 6, 1, 9, 0, 0)), 'Close price': 33.3333,
        'Commission': 0, 'Swap': 0, 'Rollover': 0, 'Gross P/L': 0,
      });
      const buf = makeXtbBuffer([impreciseRow]);
      const [tx] = await xtbParser.parse(buf);
      // 3 × 33.3333 = 99.9999 → rounded to 100.00
      expect(tx.saleGrossAmount).toBe(100.00);
    });

    it('rounds float imprecision in acquisitionCostAmount to 2dp', async () => {
      const impreciseRow = xtbRow({
        'Position': 998, 'Symbol': 'TEST.US', 'Type': 'BUY',
        'Volume': 3,
        'Open time': new Date(Date.UTC(2024, 0, 1, 9, 0, 0)), 'Open price': 33.3333,
        'Close time': new Date(Date.UTC(2024, 6, 1, 9, 0, 0)), 'Close price': 40,
        'Commission': 0, 'Swap': 0, 'Rollover': 0, 'Gross P/L': 20,
      });
      const buf = makeXtbBuffer([impreciseRow]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.acquisitionCostAmount).toBe(100.00); // 3 × 33.3333 = 99.9999 → 100.00
    });
  });

  describe('date handling', () => {
    it('extracts UTC date from ISO string returned by SheetJS', async () => {
      // Date.UTC(2024,0,15,9,0,0) → "2024-01-15T09:00:00.000Z" → "2024-01-15"
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.acquisitionDate).toBe('2024-01-15');
      expect(tx.saleDate).toBe('2024-06-20');
    });

    it('uses UTC date to avoid timezone off-by-one', async () => {
      // A date at 09:00 UTC is still the same day in all UTC-12 to UTC+14 zones.
      const row = xtbRow({
        'Position': 1, 'Symbol': 'SPY.US', 'Type': 'BUY', 'Volume': 1,
        'Open time': new Date(Date.UTC(2024, 11, 31, 9, 0, 0)),  // 2024-12-31
        'Open price': 500,
        'Close time': new Date(Date.UTC(2025, 0, 2, 9, 0, 0)),   // 2025-01-02
        'Close price': 510,
        'Commission': 0, 'Swap': 0, 'Rollover': 0, 'Gross P/L': 10,
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
        // 'Close time' intentionally omitted → null → excelDateToIso returns undefined
        'Close price': 110,
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
      // Simulate a file where the header is buried after several non-empty rows
      const manyLeadingRows = Array.from({ length: 10 }, (_, i) => [
        `Section ${i}`, null, null, null, null,
      ]);
      const buf = makeXtbBuffer([BUY_AAPL_US], { leadingRows: manyLeadingRows });
      const result = await xtbParser.parse(buf);
      expect(result[0].ticker).toBe('AAPL');
    });

    it('handles sheet name with trailing space (as in real XTB export)', async () => {
      // Real XTB file uses "CLOSED POSITION HISTORY " (trailing space)
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

    it('sets exchangeRateSaleToPLN = null (triggers auto-fetch)', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const [tx] = await xtbParser.parse(buf);
      expect(tx.exchangeRateSaleToPLN).toBeNull();
    });

    it('sets exchangeRateAcquisitionToPLN = null', async () => {
      const buf = makeXtbBuffer([BUY_AAPL_US]);
      const [tx] = await xtbParser.parse(buf);
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
      // Build a file with 30 non-header rows then the actual header — exceeds scan limit
      const manyLeadingRows = Array.from({ length: 30 }, (_, i) => [`Row ${i}`, null]);
      const ws = XLSX.utils.aoa_to_sheet([
        ...manyLeadingRows,
        [...XTB_HEADERS],
        [...BUY_AAPL_US],
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CLOSED POSITION HISTORY');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
      await expect(xtbParser.parse(buf)).rejects.toThrow('Nie znaleziono wiersza nagłówkowego');
    });

    it('throws when required columns are missing', async () => {
      // Only a partial header — missing 'Close price' and others
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

// ─── Fixture file tests ────────────────────────────────────────────────────────

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

  it('first transaction: IB01.UK BUY (from real account file)', async () => {
    const buf = loadFixture('xtb_closed_positions.xlsx');
    const result = await xtbParser.parse(buf);
    const tx = result[0];
    expect(tx.ticker).toBe('IB01');
    expect(tx.currency).toBe('GBP');
    expect(tx.saleDate).toBe('2025-11-05');
    expect(tx.acquisitionDate).toBe('2025-08-26');
    expect(tx.saleGrossAmount).toBe(236.20);       // 2 × 118.10
    expect(tx.acquisitionCostAmount).toBe(234.24); // 2 × 117.12
    expect(tx.importSource).toBe('XTB');
  });

  it('second transaction: AAPL.US BUY', async () => {
    const buf = loadFixture('xtb_closed_positions.xlsx');
    const result = await xtbParser.parse(buf);
    const tx = result[1];
    expect(tx.ticker).toBe('AAPL');
    expect(tx.currency).toBe('USD');
    expect(tx.saleDate).toBe('2025-06-20');
    expect(tx.acquisitionDate).toBe('2025-01-15');
    expect(tx.saleGrossAmount).toBe(2251.00);  // 10 × 225.10
    expect(tx.acquisitionCostAmount).toBe(1855.00); // 10 × 185.50
  });

  it('third transaction: BMW.DE BUY (EUR currency)', async () => {
    const buf = loadFixture('xtb_closed_positions.xlsx');
    const result = await xtbParser.parse(buf);
    const tx = result[2];
    expect(tx.ticker).toBe('BMW');
    expect(tx.currency).toBe('EUR');
    expect(tx.saleDate).toBe('2025-09-15');
    expect(tx.acquisitionDate).toBe('2025-03-10');
    expect(tx.saleGrossAmount).toBe(494.00); // 5 × 98.80
    expect(tx.acquisitionCostAmount).toBe(462.00); // 5 × 92.40
  });

  it('finds header row after realistic account-info rows (row 13 in fixture)', async () => {
    // The fixture has 12 rows before the column headers — confirms the scanner
    // works correctly on a file that matches the real XTB export layout.
    const buf = loadFixture('xtb_closed_positions.xlsx');
    const result = await xtbParser.parse(buf);
    expect(result.length).toBeGreaterThan(0);
  });

  it('all transactions have importSource = XTB and null exchange rates', async () => {
    const buf = loadFixture('xtb_closed_positions.xlsx');
    const result = await xtbParser.parse(buf);
    for (const tx of result) {
      expect(tx.importSource).toBe('XTB');
      expect(tx.exchangeRateSaleToPLN).toBeNull();
      expect(tx.exchangeRateAcquisitionToPLN).toBeNull();
      expect(tx.zeroCostFlag).toBe(false);
      expect(tx.acquisitionMode).toBe('purchase');
    }
  });
});
