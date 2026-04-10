import { useState, useEffect, useMemo, useRef } from 'react';
import type { HistoricalPrice } from '../types/asset';
import type { SellAnalysisResult } from '../types/sellAnalysis';
import { fitGaussianHmm, detectCurrentRegime } from '../utils/hmm';
import { runSellAnalysis } from '../utils/sellAnalysis';

const DEBOUNCE_MS = 300;

export interface UseSellAnalysisResult {
  analysis: SellAnalysisResult | null;
  isLoading: boolean;
}

function logReturns(prices: number[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) ret.push(Math.log(prices[i] / prices[i - 1]));
  }
  return ret;
}

function dataSeed(prices: number[]): number {
  let h = 0;
  for (let i = 0; i < prices.length; i++) h = ((h << 5) - h + (prices[i] * 1000) | 0) | 0;
  return h >>> 0;
}

export function useSellAnalysis(
  stockHistory: HistoricalPrice[] | null,
  currentPrice: number,
  horizonDays: number,
  enabled: boolean,
): UseSellAnalysisResult {
  const prepared = useMemo(() => {
    if (!stockHistory || stockHistory.length < 30 || currentPrice <= 0 || !enabled) return null;
    const prices = stockHistory.map((p) => p.close);
    const logRet = logReturns(prices);
    if (logRet.length < 20) return null;
    const seed = dataSeed(prices);
    return { logRet, currentPrice, seed };
  }, [stockHistory, currentPrice, enabled]);

  const [analysis, setAnalysis] = useState<SellAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const computeRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // Clear any pending debounce/compute on input change
    clearTimeout(debounceRef.current);
    clearTimeout(computeRef.current);

    if (!prepared) {
      setAnalysis(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Debounce rapid horizon changes, then defer heavy computation
    debounceRef.current = setTimeout(() => {
      computeRef.current = setTimeout(() => {
        try {
          const model = fitGaussianHmm(prepared.logRet);
          if (!model) {
            setAnalysis(null);
            setIsLoading(false);
            return;
          }
          const regime = detectCurrentRegime(prepared.logRet, model);

          const result = runSellAnalysis(
            model,
            regime.currentState,
            prepared.currentPrice,
            horizonDays,
            prepared.seed,
          );

          setAnalysis({ ...result, regimeInfo: regime });
        } catch {
          setAnalysis(null);
        } finally {
          setIsLoading(false);
        }
      }, 0);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceRef.current);
      clearTimeout(computeRef.current);
    };
  }, [prepared, horizonDays]);

  return { analysis, isLoading };
}
