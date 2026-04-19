import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock SheetJS ─────────────────────────────────────────────────────────────

function makeMockWorkbook(rows: unknown[][], sheetName: string) {
  return {
    SheetNames: [sheetName],
    Sheets: { [sheetName]: { __rows: rows } },
  };
}

vi.mock('xlsx', () => ({
  read: () => {
    const sheetName = ((globalThis as Record<string, unknown>).__xtbSheetName as string) ?? 'CLOSED POSITION HISTORY';
    const rows = (globalThis as Record<string, unknown>).__xtbMockRows as unknown[][];
    return makeMockWorkbook(rows, sheetName);
  },
  utils: {
    sheet_to_json: (sheet: { __rows: unknown[][] }) => sheet.__rows,
  },
}));

const { xtbParser } = await import('../utils/brokerParsers/xtb');

function setMockRows(rows: unknown[][], sheetName = 'CLOSED POSITION HISTORY') {
  (globalThis as Record<string, unknown>).__xtbMockRows = rows;
  (globalThis as Record<string, unknown>).__xtbSheetName = sheetName;
}

// ─── Test data ────────────────────────────────────────────────────────────────

const HEADERS_ROW = [
  null, 'Position', 'Symbol', 'Type', 'Volume',
  'Open time', 'Open price', 'Close time', 'Close price',
  'Open origin', 'Close origin', 'Purchase value', 'Sale value',
  'SL', 'TP', 'Margin', 'Commission', 'Swap', 'Rollover', 'Gross P/L', 'Comment',
];

// BUY (long position): AAPL.US — standard US stock
const BUY_ROW_US = [
  null, 1234567890, 'AAPL.US', 'BUY', 10,
  new Date('2024-01-15T14:30:00Z'), 185.50,
  new Date('2024-06-20T09:12:00Z'), 225.10,
  'xStation 5', 'xStation 5',
  1855.00, 2251.00,
  null, null, null, -0.50, 0.00, 0.00, 396.00, '',
];

// BUY (long position): BMW.DE — German stock (EUR)
const BUY_ROW_DE = [
  null, 9876543210, 'BMW.DE', 'BUY', 5,
  new Date('2024-03-10T10:00:00Z'), 92.40,
  new Date('2024-09-15T15:30:00Z'), 98.80,
  'xStation 5', 'xStation 5',
  462.00, 494.00,
  null, null, null, 0.00, 0.00, 0.00, 32.00, '',
];

// SELL (short position) — should be skipped
const SELL_ROW_SHORT = [
  null, 1111111111, 'TSLA.US', 'SELL', 2,
  new Date('2024-02-01T09:00:00Z'), 200.00,
  new Date('2024-02-10T15:00:00Z'), 180.00,
  'xStation 5', 'xStation 5',
  400.00, 360.00,
  null, null, null, 0.00, 0.00, 0.00, 40.00, '',
];

// Total (summary) row — should be skipped
const TOTAL_ROW = [
  null, 'Total', '', '', '',
  '', '', '', '',
  '', '', '', '',
  '', '', '', -0.50, 0.00, 0.00, 428.00, '',
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('xtbParser.parse', () => {
  beforeEach(() => {
    setMockRows([]);
  });

  it('parses BUY rows for US stocks into TaxTransactions', async () => {
    setMockRows([HEADERS_ROW, BUY_ROW_US]);

    const result = await xtbParser.parse(new ArrayBuffer(0));

    expect(result).toHaveLength(1);
    const tx = result[0];

    expect(tx.ticker).toBe('AAPL');
    expect(tx.currency).toBe('USD');
    expect(tx.saleDate).toBe('2024-06-20');
    expect(tx.acquisitionDate).toBe('2024-01-15');
    expect(tx.saleGrossAmount).toBe(2251); // 10 × 225.10
    expect(tx.acquisitionCostAmount).toBe(1855); // 10 × 185.50
    expect(tx.zeroCostFlag).toBe(false);
    expect(tx.acquisitionMode).toBe('purchase');
    expect(tx.exchangeRateSaleToPLN).toBeNull();
    expect(tx.exchangeRateAcquisitionToPLN).toBeNull();
    expect(tx.importSource).toBe('XTB');
  });

  it('parses BUY rows for German stocks as EUR', async () => {
    setMockRows([HEADERS_ROW, BUY_ROW_DE]);

    const result = await xtbParser.parse(new ArrayBuffer(0));

    expect(result).toHaveLength(1);
    const tx = result[0];

    expect(tx.ticker).toBe('BMW');
    expect(tx.currency).toBe('EUR');
    expect(tx.saleGrossAmount).toBe(494); // 5 × 98.80
    expect(tx.acquisitionCostAmount).toBe(462); // 5 × 92.40
  });

  it('skips SELL (short) rows', async () => {
    setMockRows([HEADERS_ROW, SELL_ROW_SHORT, BUY_ROW_US]);

    const result = await xtbParser.parse(new ArrayBuffer(0));

    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('AAPL');
  });

  it('skips the Total summary row', async () => {
    setMockRows([HEADERS_ROW, BUY_ROW_US, TOTAL_ROW]);

    const result = await xtbParser.parse(new ArrayBuffer(0));
    expect(result).toHaveLength(1);
  });

  it('handles multiple positions', async () => {
    setMockRows([HEADERS_ROW, BUY_ROW_US, BUY_ROW_DE, SELL_ROW_SHORT, TOTAL_ROW]);

    const result = await xtbParser.parse(new ArrayBuffer(0));
    expect(result).toHaveLength(2);
  });

  it('rounds imprecise float amounts to 2 decimal places', async () => {
    const impreciseRow = [...BUY_ROW_US];
    impreciseRow[8] = 225.10001; // Close price with float imprecision
    setMockRows([HEADERS_ROW, impreciseRow]);

    const result = await xtbParser.parse(new ArrayBuffer(0));
    expect(result[0].saleGrossAmount).toBe(2251); // 10 × 225.10001 rounded to 2dp = 2251.00
  });

  it('strips exchange suffix from ticker symbol', async () => {
    setMockRows([HEADERS_ROW, BUY_ROW_US, BUY_ROW_DE]);

    const result = await xtbParser.parse(new ArrayBuffer(0));
    expect(result[0].ticker).toBe('AAPL');
    expect(result[1].ticker).toBe('BMW');
  });

  it('throws when sheet not found', async () => {
    setMockRows([], 'WRONG SHEET');

    await expect(xtbParser.parse(new ArrayBuffer(0))).rejects.toThrow('CLOSED POSITION HISTORY');
  });

  it('throws when no BUY positions found', async () => {
    setMockRows([HEADERS_ROW, SELL_ROW_SHORT, TOTAL_ROW]);

    await expect(xtbParser.parse(new ArrayBuffer(0))).rejects.toThrow('Nie znaleziono');
  });

  it('throws when required columns are missing', async () => {
    setMockRows([[null, 'Position', 'Symbol'], BUY_ROW_US]); // missing most columns

    await expect(xtbParser.parse(new ArrayBuffer(0))).rejects.toThrow('brak wymaganych kolumn');
  });

  it('generates unique IDs for each transaction', async () => {
    setMockRows([HEADERS_ROW, BUY_ROW_US, BUY_ROW_DE]);

    const result = await xtbParser.parse(new ArrayBuffer(0));
    const ids = result.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sets importSource to XTB', async () => {
    setMockRows([HEADERS_ROW, BUY_ROW_US]);

    const result = await xtbParser.parse(new ArrayBuffer(0));
    expect(result[0].importSource).toBe('XTB');
  });
});

describe('currencyFromSymbol (via xtbParser)', () => {
  // Test currency mapping indirectly through a parse call for each suffix
  const testCases: Array<[string, string]> = [
    ['AAPL.US', 'USD'],
    ['BMW.DE', 'EUR'],
    ['BNP.FR', 'EUR'],
    ['ASML.NL', 'EUR'],
    ['IBE.ES', 'EUR'],
    ['HSBA.UK', 'GBP'],
    ['PKN.PL', 'PLN'],
    ['NESN.CH', 'CHF'],
    ['UNKNOWN.XY', 'USD'], // fallback
  ];

  testCases.forEach(([symbol, expectedCurrency]) => {
    it(`maps ${symbol} → ${expectedCurrency}`, async () => {
      const row = [null, 123, symbol, 'BUY', 1,
        new Date('2024-01-01'), 100, new Date('2024-06-01'), 110,
        '', '', 100, 110, null, null, null, 0, 0, 0, 10, ''];
      setMockRows([HEADERS_ROW, row]);

      const result = await xtbParser.parse(new ArrayBuffer(0));
      expect(result[0].currency).toBe(expectedCurrency);
    });
  });
});
