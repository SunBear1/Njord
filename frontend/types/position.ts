export type PositionCurrency = 'USD' | 'EUR' | 'GBP' | 'PLN';
export const POSITION_CURRENCIES: PositionCurrency[] = ['USD', 'EUR', 'GBP', 'PLN'];

export interface Position {
  id: string;
  ticker: string;
  quantity: number;
  avgPrice: number;
  currency: PositionCurrency;
  source: string;
  addedAt: number;
}

export interface PositionDraft {
  ticker: string;
  quantity: string;
  avgPrice: string;
  currency: PositionCurrency;
}

export interface PositionValidationErrors {
  ticker?: string;
  quantity?: string;
  avgPrice?: string;
  currency?: string;
}

export function validatePositionDraft(draft: PositionDraft): PositionValidationErrors {
  const errors: PositionValidationErrors = {};
  if (!draft.ticker.trim()) {
    errors.ticker = 'Ticker jest wymagany';
  }
  const qty = parseFloat(draft.quantity);
  if (!draft.quantity || isNaN(qty) || qty <= 0) {
    errors.quantity = 'Ilość musi być większa od 0';
  }
  const price = parseFloat(draft.avgPrice);
  if (!draft.avgPrice || isNaN(price) || price < 0) {
    errors.avgPrice = 'Cena nie może być ujemna';
  }
  if (!draft.currency) {
    errors.currency = 'Waluta jest wymagana';
  }
  return errors;
}

export function draftToPosition(draft: PositionDraft, id: string): Position {
  return {
    id,
    ticker: draft.ticker.trim().toUpperCase(),
    quantity: parseFloat(draft.quantity),
    avgPrice: parseFloat(draft.avgPrice),
    currency: draft.currency,
    source: 'manual',
    addedAt: Date.now(),
  };
}
