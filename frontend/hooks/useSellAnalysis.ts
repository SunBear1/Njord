import { useState, useEffect, useMemo, useRef } from 'react';
import type { HistoricalPrice } from '../types/asset';
import type { SellAnalysisResult } from '../types/sellAnalysis';
import type { SellAnalysisWorkerResult } from '../workers/sellAnalysis.worker';

const DEBOUNCE_MS = 300;

interface UseSellAnalysisResult {
  analysis: SellAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
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
  const [analysis, setAnalysis] = useState<SellAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  const prepared = useMemo(() => {
    if (!stockHistory || stockHistory.length < 30 || currentPrice <= 0 || !enabled) return null;
    const prices = stockHistory.map((p) => p.close);
    const logRet = logReturns(prices);
    if (logRet.length < 20) return null;
    const seed = dataSeed(prices);
    return { logRet, currentPrice, seed };
  }, [stockHistory, currentPrice, enabled]);

  // Create the worker once on mount
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(
        new URL('../workers/sellAnalysis.worker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;
    } catch {
      // Worker creation can fail in test environments — fall back gracefully
      workerRef.current = null;
    }

    return () => {
      worker?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (!prepared) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- safe early-return guard, prepared derives from props not hook state
      setAnalysis(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const worker = workerRef.current;

    if (worker) {
      // Remove any stale handler from a previous run before registering a new one
      if (handlerRef.current) {
        worker.removeEventListener('message', handlerRef.current);
        handlerRef.current = null;
      }

      // Web Worker path — off main thread
      debounceRef.current = setTimeout(() => {
        const handler = (event: MessageEvent<{ type: string; payload?: SellAnalysisWorkerResult; message?: string }>) => {
          worker.removeEventListener('message', handler);
          handlerRef.current = null;
          if (event.data.type === 'result' && event.data.payload) {
            const { result, regime } = event.data.payload;
            setAnalysis({ ...result, regimeInfo: regime });
          } else {
            setAnalysis(null);
            setError(event.data.message ?? 'Analiza nie powiodła się.');
          }
          setIsLoading(false);
        };
        handlerRef.current = handler;
        worker.addEventListener('message', handler);
        worker.postMessage({
          type: 'run',
          payload: { ...prepared, horizonDays },
        });
      }, DEBOUNCE_MS);
    } else {
      // Fallback: async on main thread (test/SSR environments)
      debounceRef.current = setTimeout(() => {
        void (async () => {
          try {
            const { fitGaussianHmm, detectCurrentRegime } = await import('../utils/hmm');
            const { runSellAnalysis } = await import('../utils/sellAnalysis');
            const model = fitGaussianHmm(prepared.logRet);
            if (!model) { setAnalysis(null); setError('Nie udało się dopasować modelu HMM.'); setIsLoading(false); return; }
            const regime = detectCurrentRegime(prepared.logRet, model);
            const result = runSellAnalysis(model, regime.currentState, prepared.currentPrice, horizonDays, prepared.seed);
            setAnalysis({ ...result, regimeInfo: regime });
          } catch (err) {
            setAnalysis(null);
            setError(err instanceof Error ? err.message : 'Analiza nie powiodła się.');
          } finally {
            setIsLoading(false);
          }
        })();
      }, DEBOUNCE_MS);
    }

    return () => {
      clearTimeout(debounceRef.current);
      // Clean up any pending handler to prevent stale results
      if (worker && handlerRef.current) {
        worker.removeEventListener('message', handlerRef.current);
        handlerRef.current = null;
      }
    };
  }, [prepared, horizonDays]);

  return { analysis, isLoading, error };
}
