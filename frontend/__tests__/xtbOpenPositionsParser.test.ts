import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseXtbOpenPositions } from '../utils/brokerParsers/xtbOpenPositions';

const XTB_OPEN_HEADERS = [
  'Position', 'Symbol', 'Type', 'Volume', 'Open time', 'Open price',
  'Market price', 'SL', 'TP', 'Commission', 'Swap', 'Gross P/L', 'Comment',
] as const;

function xtbRow(values: Partial<Record<(typeof XTB_OPEN_HEADERS)[number], unknown>>): unknown[] {
  return XTB_OPEN_HEADERS.map((h) => (values as Record<string, unknown>)[h] ?? null);
}

const TOTAL_ROW = xtbRow({ Position: 'Total', Commission: 0, Swap: 0, 'Gross P/L': 0 });

const ACCOUNT_HEADER_USD: unknown[][] = [
  [null, null, null, null, 'Name and surname', null, null, 'Account', null, null, 'Currency', null, null],
  [null, null, null, null, 'Test User', null, null, '12345678', null, null, 'USD', null, null],
];

function makeOpenPositionsBuffer(
  dataRows: unknown[][],
  { leadingRows = [] as unknown[][], sheetName = 'OPEN POSITIONS' } = {},
): ArrayBuffer {
  const allRows = [...leadingRows, XTB_OPEN_HEADERS as unknown as unknown[], ...dataRows, TOTAL_ROW];
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
}

const BUY_AAPL = xtbRow({
  Position: 111, Symbol: 'AAPL.US', Type: 'BUY', Volume: 10,
  'Open time': new Date(Date.UTC(2025, 0, 15)), 'Open price': 185.5, 'Market price': 230.1,
});

const BUY_IWDA = xtbRow({
  Position: 112, Symbol: 'IWDA.UK', Type: 'BUY', Volume: 3,
  'Open time': new Date(Date.UTC(2025, 2, 1)), 'Open price': 90.2, 'Market price': 95.4,
});

const SELL_SHORT = xtbRow({
  Position: 113, Symbol: 'TSLA.US', Type: 'SELL', Volume: 5,
  'Open time': new Date(Date.UTC(2025, 3, 1)), 'Open price': 250, 'Market price': 240,
});

describe('parseXtbOpenPositions', () => {
  it('TestParseXtbOpenPositions_WhenGivenBuyRows_ExpectsPositionDraftsWithParsedFields', async () => {
    const buffer = makeOpenPositionsBuffer([BUY_AAPL], { leadingRows: ACCOUNT_HEADER_USD });
    const result = await parseXtbOpenPositions(buffer);

    expect(result.positions).toEqual([
      { ticker: 'AAPL', quantity: '10', avgPrice: '185.5', currency: 'USD', source: 'XTB' },
    ]);
    expect(result.skippedShortCount).toBe(0);
  });

  it('TestParseXtbOpenPositions_WhenMultipleBuyRows_ExpectsAllImported', async () => {
    const buffer = makeOpenPositionsBuffer([BUY_AAPL, BUY_IWDA], { leadingRows: ACCOUNT_HEADER_USD });
    const result = await parseXtbOpenPositions(buffer);
    expect(result.positions).toHaveLength(2);
    expect(result.positions.map((p) => p.ticker)).toEqual(['AAPL', 'IWDA.L']);
  });

  it('TestParseXtbOpenPositions_WhenShortPositionPresent_ExpectsSkippedAndCounted', async () => {
    const buffer = makeOpenPositionsBuffer([BUY_AAPL, SELL_SHORT], { leadingRows: ACCOUNT_HEADER_USD });
    const result = await parseXtbOpenPositions(buffer);
    expect(result.positions).toHaveLength(1);
    expect(result.skippedShortCount).toBe(1);
  });

  it('TestParseXtbOpenPositions_WhenCurrencyUnsupported_ExpectsFallbackToUsd', async () => {
    const header: unknown[][] = [
      [null, null, null, null, 'Name and surname', null, null, 'Account', null, null, 'Currency', null, null],
      [null, null, null, null, 'Test User', null, null, '12345678', null, null, 'CZK', null, null],
    ];
    const buffer = makeOpenPositionsBuffer([BUY_AAPL], { leadingRows: header });
    const result = await parseXtbOpenPositions(buffer);
    expect(result.positions[0].currency).toBe('USD');
  });

  it('TestParseXtbOpenPositions_WhenOnlyShortPositions_ExpectsThrows', async () => {
    const buffer = makeOpenPositionsBuffer([SELL_SHORT], { leadingRows: ACCOUNT_HEADER_USD });
    await expect(parseXtbOpenPositions(buffer)).rejects.toThrow(/nie znaleziono/i);
  });

  it('TestParseXtbOpenPositions_WhenSheetNameWrong_ExpectsThrows', async () => {
    const buffer = makeOpenPositionsBuffer([BUY_AAPL], { leadingRows: ACCOUNT_HEADER_USD, sheetName: 'CLOSED POSITION HISTORY' });
    await expect(parseXtbOpenPositions(buffer)).rejects.toThrow(/OPEN POSITIONS/);
  });

  it('TestParseXtbOpenPositions_WhenRequiredColumnsMissing_ExpectsThrows', async () => {
    const ws = XLSX.utils.aoa_to_sheet([['Position', 'Symbol', 'Type'], [1, 'AAPL.US', 'BUY']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OPEN POSITIONS');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
    await expect(parseXtbOpenPositions(buffer)).rejects.toThrow(/brak wymaganych kolumn/i);
  });
});
