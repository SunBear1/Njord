/**
 * Shared helpers for XTB xStation 5 XLSX export parsers (closed positions for
 * tax reporting, open positions for portfolio import) — both files share the
 * same header layout, symbol format, and account-currency detection.
 */

/**
 * XTB exchange suffix → Yahoo Finance suffix mapping.
 * US tickers need no suffix on Yahoo; others need exchange-specific ones.
 */
const XTB_TO_YAHOO_SUFFIX: Record<string, string> = {
  US: '',    // AAPL.US → AAPL
  UK: '.L',  // IB01.UK → IB01.L (London)
  DE: '.DE', // BMW.DE  → BMW.DE (Xetra)
  FR: '.PA', // AIR.FR  → AIR.PA (Euronext Paris)
  NL: '.AS', // ASML.NL → ASML.AS (Euronext Amsterdam)
  ES: '.MC', // SAN.ES  → SAN.MC (Madrid)
  IT: '.MI', // ENI.IT  → ENI.MI (Milan)
  CH: '.SW', // NESN.CH → NESN.SW (SIX Swiss)
  BE: '.BR', // ABI.BE  → ABI.BR (Brussels)
  PT: '.LS', // EDP.PT  → EDP.LS (Lisbon)
  HK: '.HK', // 0005.HK → 0005.HK (Hong Kong)
};

/**
 * Convert XTB symbol to Yahoo Finance-compatible ticker.
 * Maps exchange suffixes: 'AAPL.US' → 'AAPL', 'IB01.UK' → 'IB01.L'.
 * Unknown suffixes are stripped as best-effort fallback.
 */
export function tickerFromSymbol(symbol: string): string {
  const dot = symbol.lastIndexOf('.');
  if (dot === -1) return symbol;
  const base = symbol.slice(0, dot);
  const suffix = symbol.slice(dot + 1).toUpperCase();
  const yahooSuffix = XTB_TO_YAHOO_SUFFIX[suffix];
  if (yahooSuffix !== undefined) return base + yahooSuffix;
  return base; // unknown suffix → strip
}

const KNOWN_CURRENCIES = new Set(['PLN', 'USD', 'EUR', 'GBP', 'CHF', 'CZK', 'HUF', 'RON']);

/**
 * Detect the account currency from the sheet header area.
 *
 * XTB exports have a "Currency" label in the first ~15-20 rows (row 6 in real files).
 * The value cell is directly below or in the same row after the label.
 * Returns 'PLN' as fallback if detection fails (most Polish XTB accounts are PLN).
 */
export function detectAccountCurrency(rows: unknown[][]): string {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      if (typeof row[j] === 'string' && (row[j] as string).trim() === 'Currency') {
        const nextRow = rows[i + 1];
        if (nextRow && j < nextRow.length) {
          const val = String(nextRow[j] ?? '').trim().toUpperCase();
          if (KNOWN_CURRENCIES.has(val)) return val;
        }
      }
    }
  }
  return 'PLN';
}

/**
 * Convert an Excel datetime value to ISO date string 'YYYY-MM-DD'.
 * SheetJS reads Excel date cells as JavaScript Date objects when the cell
 * is formatted as a date. We extract year/month/day in UTC.
 */
export function excelDateToIso(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (raw instanceof Date) {
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const d = String(raw.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
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

export const XTB_MAX_ROWS = 5_000;
export const XTB_MAX_AMOUNT = 1e9;

/** Guard against prototype-pollution keys in parsed XLSX rows. */
export function safeGet(row: unknown[], idx: number): unknown {
  if (idx < 0 || idx >= row.length) return undefined;
  return row[idx];
}

/** Validate a monetary/numeric amount: must be finite and within [min, max]. */
export function safeNumber(raw: unknown, min = 0, max = XTB_MAX_AMOUNT): number {
  const n = Number(raw);
  if (!isFinite(n) || n < min || n > max) return NaN;
  return n;
}

/**
 * Find the header row: scan up to first 25 rows for the row that contains
 * all three sentinel column names. SheetJS drops the leading empty column
 * that openpyxl sees, so 'Position' can appear at any index — we check by value.
 */
export function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i] as unknown[];
    if (row.includes('Position') && row.includes('Symbol') && row.includes('Type')) {
      return i;
    }
  }
  return -1;
}

export function buildColumnMap(headerRow: (string | null)[]): Record<string, number> {
  const colMap: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    if (h != null && typeof h === 'string') colMap[h.trim()] = i;
  });
  return colMap;
}
