import type { PositionCurrency } from './position';

export type HoldingAssetClass = 'bond' | 'savings' | 'stock' | 'termDeposit';
export type StockInstrumentType = 'stock' | 'etf';

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

export interface TermDepositHolding extends BaseHolding {
  assetClass: 'termDeposit';
  bankName: string;
  principal: number;
  interestRatePercent: number; // fixed for the whole term
  openDate: string; // ISO date (YYYY-MM-DD)
  maturityDate: string; // ISO date (YYYY-MM-DD) — value stops growing after this date
}

export interface StockHolding extends BaseHolding {
  assetClass: 'stock';
  ticker: string;
  quantity: number;
  avgPrice: number;
  currency: PositionCurrency;
  instrumentType: StockInstrumentType; // auto-detected at add-time (Yahoo Finance metadata)
}

export type Holding = BondHolding | SavingsHolding | StockHolding | TermDepositHolding;

export type BondHoldingDraft = Omit<BondHolding, 'id' | 'addedAt' | 'updatedAt'>;
export type SavingsHoldingDraft = Omit<SavingsHolding, 'id' | 'addedAt' | 'updatedAt'>;
export type StockHoldingDraft = Omit<StockHolding, 'id' | 'addedAt' | 'updatedAt'>;
export type TermDepositHoldingDraft = Omit<TermDepositHolding, 'id' | 'addedAt' | 'updatedAt'>;
export type HoldingDraft = BondHoldingDraft | SavingsHoldingDraft | StockHoldingDraft | TermDepositHoldingDraft;
