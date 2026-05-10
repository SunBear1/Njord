// Shared URL patterns
export const MARKET_DATA_URL = '**/api/v1/finance/stocks/**';
export const NBP_URL = 'https://api.nbp.pl/**';
export const INFLATION_URL = '**/api/v1/finance/inflation**';
export const CURRENCY_URL = '**/api/v1/finance/currency**';

// 252 trading days of synthetic AAPL-like data
export const VALID_ASSET_RESPONSE = {
  data: Array.from({ length: 252 }, (_, index) => ({
    timestamp: Math.floor(Date.now() / 1000) - index * 86_400,
    open: 150 * (1 + Math.sin(index * 0.1) * 0.05),
    high: 155 * (1 + Math.sin(index * 0.1) * 0.05),
    low: 145 * (1 + Math.sin(index * 0.1) * 0.05),
    close: 150 * (1 + Math.sin(index * 0.1) * 0.05),
    volume: 1_000_000,
  })),
  _meta: {
    source: 'yahoo',
    name: 'Apple Inc.',
    currency: 'USD',
    type: 'stock',
    currentPrice: 150,
  },
};

// 252 days of USD/PLN rates oscillating around 4.0
export const VALID_NBP_HISTORICAL_RESPONSE = {
  rates: Array.from({ length: 252 }, (_, index) => ({
    effectiveDate: new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10),
    mid: 4.0 * (1 + Math.sin(index * 0.05) * 0.02),
  })),
};

// Single NBP rate for a specific date (used by tax calculator tests)
export const NBP_RATE_RESPONSE = {
  rates: [{ mid: 4.00, effectiveDate: '2024-06-13' }],
};

export const VALID_CURRENCY_RESPONSE = {
  data: [
    { source: 'alior', pair: 'USD/PLN', bid: 3.92, ask: 4.18, mid: 4.05, timestamp: '2026-05-10T10:00:00Z' },
    { source: 'nbp', pair: 'USD/PLN', bid: 3.95, ask: 4.10, mid: 4.025, timestamp: '2026-05-10T00:00:00Z' },
  ],
};

export const VALID_INFLATION_RESPONSE = {
  data: [{ year: 2026, month: 3, cpi_yoy_pct: 2.4 }],
};
