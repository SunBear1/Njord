import type { AssetData } from './asset';
import type { FxRate } from '../providers/nbpProvider';

/** Structured error codes returned by /api/analyze. */
export type ErrorCode =
  | 'TICKER_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INVALID_TICKER'
  | 'UPSTREAM_ERROR';

export interface ProxyResponse {
  assetData: AssetData;
  fxData: {
    currentRate: number;
    historicalRates: FxRate[];
  };
  /** Which upstream data source served this response. */
  source?: 'yahoo' | 'twelvedata';
}

/** Error shape returned by /api/analyze on failure. */
export interface ProxyErrorResponse {
  error: string;
  code: ErrorCode;
}
