import { fmtPLNGrosze } from '../../utils/formatting';
import type { TaxTransaction } from '../../types/tax';

export const INPUT_CLS =
  'w-full border border-edge-strong dark:border-edge-strong rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-surface-dark/30 dark:bg-surface-dark-alt dark:text-on-dark ' +
  'dark:placeholder-faint';
export const LABEL_CLS = 'text-xs font-medium text-body dark:text-faint';
export const COL_COUNT = 9;

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'DKK', 'SEK', 'PLN'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function generateId(): string {
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newTransaction(): TaxTransaction {
  return {
    id: generateId(),
    tradeType: 'sale',
    acquisitionMode: 'purchase',
    zeroCostFlag: false,
    saleDate: '',
    currency: 'USD',
    saleGrossAmount: 0,
    acquisitionCostAmount: 0,
    saleBrokerFee: 0,
    acquisitionBrokerFee: 0,
    exchangeRateSaleToPLN: null,
    exchangeRateAcquisitionToPLN: null,
    showCommissions: false,
  };
}

export function fmtGain(gain: number): { text: string; cls: string } {
  if (gain > 0) return { text: `+${fmtPLNGrosze(gain)}`, cls: 'text-green-700 dark:text-green-400' };
  if (gain < 0) return { text: fmtPLNGrosze(gain), cls: 'text-red-600 dark:text-red-400' };
  return { text: fmtPLNGrosze(0), cls: 'text-body dark:text-on-dark-muted' };
}

/** Returns YYYY-MM-DD of (date − 1 day), or '' if date is empty. */
export function subtractOneDay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/** Formats YYYY-MM-DD → "19 kwietnia 2026" (Polish locale). */
export function fmtDatePL(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Parses DD/MM/RRRR → YYYY-MM-DD, or null if invalid. */
export function parsePLDate(value: string): string | null {
  if (!value || value.length < 10) return null;
  const parts = value.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) return null;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** Converts YYYY-MM-DD → DD/MM/RRRR for display. */
export function isoToPLDate(iso: string): string {
  if (!iso || iso.length !== 10) return '';
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}
