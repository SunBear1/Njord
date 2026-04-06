import type { AssetType } from '../types/asset';

export interface AssetConfig {
  label: string;
  defaultSigmaAnnual: number; // annualized volatility fallback if no API data
  supportedCurrencies: string[];
}

export const ASSET_CONFIG: Record<AssetType, AssetConfig> = {
  stock: {
    label: 'Akcja',
    defaultSigmaAnnual: 0.25, // 25% annualized volatility
    supportedCurrencies: ['USD', 'EUR', 'GBP'],
  },
  etf: {
    label: 'ETF',
    defaultSigmaAnnual: 0.18,
    supportedCurrencies: ['USD', 'EUR'],
  },
  commodity: {
    label: 'Surowiec',
    defaultSigmaAnnual: 0.20,
    supportedCurrencies: ['USD'],
  },
  crypto: {
    label: 'Krypto',
    defaultSigmaAnnual: 0.70,
    supportedCurrencies: ['USD'],
  },
};

export const DEFAULT_WIBOR_3M = 5.82; // %
export const DEFAULT_HORIZON_MONTHS = 12;
