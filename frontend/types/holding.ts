import type { PositionCurrency } from './position';

export type HoldingAssetClass = 'bond' | 'savings' | 'stock';

interface BaseHolding {
  id: string;
  source: string | null;
  addedAt: string;
  updatedAt: string;
}

export interface BondHolding extends BaseHolding {
  assetClass: 'bond';
  bondPresetId: string;
  principal: number;
  purchaseDate: string; // ISO date (YYYY-MM-DD)
}

export interface SavingsHolding extends BaseHolding {
  assetClass: 'savings';
  bankName: string;
  principal: number;
  interestRatePercent: number;
  asOfDate: string; // ISO date (YYYY-MM-DD)
}

export interface StockHolding extends BaseHolding {
  assetClass: 'stock';
  ticker: string;
  quantity: number;
  avgPrice: number;
  currency: PositionCurrency;
}

export type Holding = BondHolding | SavingsHolding | StockHolding;

export type BondHoldingDraft = Omit<BondHolding, 'id' | 'addedAt' | 'updatedAt'>;
export type SavingsHoldingDraft = Omit<SavingsHolding, 'id' | 'addedAt' | 'updatedAt'>;
export type StockHoldingDraft = Omit<StockHolding, 'id' | 'addedAt' | 'updatedAt'>;
export type HoldingDraft = BondHoldingDraft | SavingsHoldingDraft | StockHoldingDraft;
