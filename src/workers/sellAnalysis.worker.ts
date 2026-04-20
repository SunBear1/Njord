/**
 * Web Worker for heavy sell analysis computation (HMM + Monte Carlo).
 *
 * Runs fitGaussianHmm + runSellAnalysis off the main thread to avoid
 * blocking UI during the 10K-path Monte Carlo simulation.
 *
 * Message protocol:
 *   → { type: 'run', payload: SellAnalysisRequest }
 *   ← { type: 'result', payload: SellAnalysisWorkerResult }
 *   ← { type: 'error', message: string }
 */

import { fitGaussianHmm, detectCurrentRegime } from '../utils/hmm';
import { runSellAnalysis } from '../utils/sellAnalysis';

export interface SellAnalysisRequest {
  logRet: number[];
  currentPrice: number;
  horizonDays: number;
  seed: number;
}

export interface SellAnalysisWorkerResult {
  result: ReturnType<typeof runSellAnalysis>;
  regime: ReturnType<typeof detectCurrentRegime>;
}

self.onmessage = (event: MessageEvent<{ type: string; payload: SellAnalysisRequest }>) => {
  const { type, payload } = event.data;
  if (type !== 'run') return;

  try {
    const { logRet, currentPrice, horizonDays, seed } = payload;

    const model = fitGaussianHmm(logRet);
    if (!model) {
      self.postMessage({ type: 'error', message: 'HMM fitting failed' });
      return;
    }

    const regime = detectCurrentRegime(logRet, model);
    const result = runSellAnalysis(model, regime.currentState, currentPrice, horizonDays, seed);

    self.postMessage({ type: 'result', payload: { result, regime } });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
