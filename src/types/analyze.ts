import type { AssetData } from './asset';
import type { FxRate } from '../providers/nbpProvider';

export interface ProxyResponse {
  assetData: AssetData;
  fxData: {
    currentRate: number;
    historicalRates: FxRate[];
  };
}
