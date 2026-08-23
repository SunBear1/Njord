export type HoldingAssetClass = 'bond' | 'savings';

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

export type Holding = BondHolding | SavingsHolding;

export type BondHoldingDraft = Omit<BondHolding, 'id' | 'addedAt' | 'updatedAt'>;
export type SavingsHoldingDraft = Omit<SavingsHolding, 'id' | 'addedAt' | 'updatedAt'>;
export type HoldingDraft = BondHoldingDraft | SavingsHoldingDraft;
