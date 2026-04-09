/**
 * Pages Function: GET /api/analyze?ticker=AAPL&horizonMonths=12
 *
 * Fetches stock data from Twelve Data and FX rates from NBP, then runs the full
 * analysis pipeline (HMM + GARCH + Bootstrap + model selection) server-side.
 * The Twelve Data API key is kept secret in the CF Pages environment — never
 * exposed to the browser.
 *
 * Response is cached at the CF edge for 1 hour per ticker + horizon combination.
 */

import type { HistoricalPrice } from '../../src/types/asset';
import type { FxRate } from '../../src/providers/nbpProvider';
import type { Scenarios } from '../../src/types/scenario';
import type { RegimeInfo } from '../../src/utils/hmm';
import type { ModelResults, PredictionResult } from '../../src/utils/models/types';
import { bootstrapPredict } from '../../src/utils/models/bootstrap';
import { garchPredict } from '../../src/utils/models/garch';
import { hmmPredict } from '../../src/utils/models/hmmModel';
import { selectBestModel } from '../../src/utils/models/modelSelector';
import type { AnalyzeResponse } from '../../src/types/analyze';

interface Env {
  TWELVE_DATA_API_KEY: string;
}

// ── Twelve Data ────────────────────────────────────────────────────────────────

interface TwelveDataMeta {
  symbol: string;
  currency: string;
  exchange: string;
  type: string;
}

async function fetchStockData(
  ticker: string,
  apiKey: string,
): Promise<{ meta: TwelveDataMeta; historicalPrices: HistoricalPrice[]; currentPrice: number }> {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(ticker)}&interval=1day&outputsize=504&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as {
    code?: number;
    status?: string;
    message?: string;
    meta?: TwelveDataMeta;
    values?: Array<{ datetime: string; close: string }>;
  };

  if (data.code === 401) throw new Error('Nieprawidłowy klucz API Twelve Data.');
  if (data.code === 429) throw new Error('RATE_LIMIT');
  if (data.status === 'error') throw new Error(data.message || `Nie znaleziono tickera: ${ticker}`);
  if (!data.meta || !data.values?.length) throw new Error(`Nie znaleziono danych dla: ${ticker}`);

  const values = data.values;
  const currentPrice = parseFloat(values[0].close);
  if (isNaN(currentPrice)) throw new Error(`Brak ceny rynkowej dla ${ticker}`);

  const historicalPrices: HistoricalPrice[] = values
    .map((v) => ({ date: v.datetime, close: parseFloat(v.close) }))
    .filter((p) => !isNaN(p.close))
    .reverse();

  return { meta: data.meta, historicalPrices, currentPrice };
}

// ── NBP FX ─────────────────────────────────────────────────────────────────────

const NBP_BASE = 'https://api.nbp.pl/api/exchangerates/rates/A';

async function fetchFxData(currency = 'USD'): Promise<{ currentRate: number; historicalRates: FxRate[] }> {
  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const [currentRes, hist1Res, hist2Res] = await Promise.all([
    fetch(`${NBP_BASE}/${currency}/?format=json`),
    fetch(`${NBP_BASE}/${currency}/${fmt(twoYearsAgo)}/${fmt(oneYearAgo)}/?format=json`),
    fetch(`${NBP_BASE}/${currency}/${fmt(oneYearAgo)}/${fmt(now)}/?format=json`),
  ]);

  if (!currentRes.ok) throw new Error('Błąd pobierania kursu USD/PLN z NBP');

  const parseRates = async (r: Response): Promise<FxRate[]> => {
    if (!r.ok) return [];
    const d = await r.json() as { rates?: Array<{ effectiveDate: string; mid: number }> };
    return (d.rates ?? []).map((x) => ({ date: x.effectiveDate, rate: x.mid }));
  };

  const currentData = await currentRes.json() as { rates?: Array<{ mid: number }> };
  if (!currentData.rates?.length) throw new Error('NBP nie zwrócił bieżącego kursu');

  const [hist1, hist2] = await Promise.all([parseRates(hist1Res), parseRates(hist2Res)]);

  return {
    currentRate: currentData.rates[0].mid,
    historicalRates: [...hist1, ...hist2],
  };
}

// ── Analysis (mirrors useHistoricalVolatility without React hooks) ─────────────

function dailyReturns(prices: number[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) ret.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return ret;
}

function logReturns(prices: number[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) ret.push(Math.log(prices[i] / prices[i - 1]));
  }
  return ret;
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  const m = mean(arr);
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  const ax = a.slice(-n), bx = b.slice(-n);
  const ma = mean(ax), mb = mean(bx);
  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = ax[i] - ma, db = bx[i] - mb;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom > 0 ? cov / denom : 0;
}

function dataSeed(prices: number[]): number {
  let h = 0;
  for (let i = 0; i < prices.length; i++) {
    h = ((h << 5) - h + Math.round(prices[i] * 100)) | 0;
  }
  return Math.abs(h);
}

function toScenarios(pred: PredictionResult, rho: number, fxMagPct: number): Scenarios {
  const [p5, , , , p95] = pred.percentiles;
  return {
    bear: { deltaStock: p5, deltaFx: -rho * fxMagPct },
    base: { deltaStock: 0, deltaFx: 0 },
    bull: { deltaStock: p95, deltaFx: +rho * fxMagPct },
  };
}

function runAnalysis(
  historicalPrices: HistoricalPrice[],
  fxRates: FxRate[],
  horizonMonths: number,
): {
  suggestedScenarios: Scenarios;
  regime: RegimeInfo | null;
  models: ModelResults | null;
  modelScenarios: Record<string, Scenarios>;
} {
  const stockPrices = historicalPrices.map((p) => p.close);
  const stockReturns = dailyReturns(stockPrices);
  const fxReturns = dailyReturns(fxRates.map((r) => r.rate));

  if (stockReturns.length < 5 || fxReturns.length < 5) {
    return {
      suggestedScenarios: { bear: { deltaStock: -10, deltaFx: -5 }, base: { deltaStock: 0, deltaFx: 0 }, bull: { deltaStock: 10, deltaFx: 5 } },
      regime: null,
      models: null,
      modelScenarios: {},
    };
  }

  const fxDailySigma = stddev(fxReturns);
  const rho = pearsonCorrelation(stockReturns, fxReturns);
  const fxSigmaAnnual = fxDailySigma * Math.sqrt(252);
  const stockLogRet = logReturns(stockPrices);
  const seed = dataSeed(stockPrices);

  const T = horizonMonths / 12;
  const horizonDays = Math.round(horizonMonths * 21);
  const fxMagPct = (Math.exp(1.645 * fxSigmaAnnual * Math.sqrt(T) + (-(fxSigmaAnnual * fxSigmaAnnual) / 2) * T) - 1) * 100;

  const bootstrapResult = bootstrapPredict(stockLogRet, horizonDays, seed);
  const garchResult = garchPredict(stockLogRet, horizonDays, seed + 10);
  const hmmResult = hmmPredict(stockLogRet, horizonDays, seed);

  const allPredictions = [bootstrapResult, garchResult, hmmResult.prediction];
  const scoring = selectBestModel(stockLogRet, horizonDays, seed, allPredictions);
  const recommended = scoring.scored[scoring.recommendedIndex];

  const modelResults: ModelResults = { models: scoring.scored, recommended, scoring };

  const modelScenarios: Record<string, Scenarios> = {};
  for (const pred of scoring.scored) {
    if (pred.confidence > 0) {
      modelScenarios[pred.id] = toScenarios(pred, rho, fxMagPct);
    }
  }

  const suggestedScenarios = recommended.confidence > 0
    ? toScenarios(recommended, rho, fxMagPct)
    : toScenarios(bootstrapResult, rho, fxMagPct);

  return { suggestedScenarios, regime: hmmResult.regime, models: modelResults, modelScenarios };
}

// ── Handler ────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const ticker = url.searchParams.get('ticker')?.trim().toUpperCase();
  const horizonMonths = Math.max(1, Math.min(144, parseInt(url.searchParams.get('horizonMonths') ?? '12', 10) || 12));

  if (!ticker) {
    return new Response(JSON.stringify({ error: 'Brak parametru ticker' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  if (!env.TWELVE_DATA_API_KEY) {
    return new Response(JSON.stringify({ error: 'Server configuration error: API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  try {
    const [stockResult, fxResult] = await Promise.all([
      fetchStockData(ticker, env.TWELVE_DATA_API_KEY),
      fetchFxData(),
    ]);

    const { meta, historicalPrices, currentPrice } = stockResult;
    const { currentRate, historicalRates } = fxResult;

    let assetType: 'stock' | 'etf' | 'commodity' | 'crypto' = 'stock';
    const type = (meta.type || '').toLowerCase();
    if (type.includes('etf')) assetType = 'etf';
    else if (type.includes('crypto') || type.includes('digital')) assetType = 'crypto';
    else if (type.includes('commodity') || type.includes('future')) assetType = 'commodity';

    const analysis = runAnalysis(historicalPrices, historicalRates, horizonMonths);

    const response: AnalyzeResponse = {
      assetData: {
        asset: {
          ticker: meta.symbol,
          name: meta.symbol,
          type: assetType,
          currency: meta.currency || 'USD',
          currentPrice,
        },
        historicalPrices,
      },
      analyzeResult: {
        latestFxRate: currentRate,
        fxHistory: historicalRates,
        ...analysis,
        forHorizonMonths: horizonMonths,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=3600',
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nieznany błąd';
    const isRateLimit = message === 'RATE_LIMIT';
    return new Response(JSON.stringify({ error: message }), {
      status: isRateLimit ? 429 : 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};
