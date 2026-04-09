import type { AssetData } from './asset';
import type { FxRate } from '../providers/nbpProvider';
import type { Scenarios } from './scenario';
import type { RegimeInfo } from '../utils/hmm';
import type { ModelResults } from '../utils/models/types';

export interface AnalyzeResult {
  latestFxRate: number;
  fxHistory: FxRate[];
  suggestedScenarios: Scenarios;
  regime: RegimeInfo | null;
  models: ModelResults | null;
  modelScenarios: Record<string, Scenarios>;
  forHorizonMonths: number;
}

export interface AnalyzeResponse {
  assetData: AssetData;
  analyzeResult: AnalyzeResult;
}
