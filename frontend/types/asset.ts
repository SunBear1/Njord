export type AssetType = 'stock' | 'etf' | 'commodity' | 'crypto';

export interface Asset {
  ticker: string;
  name: string;
  type: AssetType;
  currency: string;
  currentPrice: number;
}

export interface HistoricalPrice {
  date: string;
  close: number;
}

export interface AssetData {
  asset: Asset;
  historicalPrices: HistoricalPrice[];
}
