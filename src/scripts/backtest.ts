/**
 * NASDAQ Backtest — Walk-forward calibration test for the Njord prediction engine.
 *
 * Imports gbmPredict DIRECTLY from the production model — single source of truth,
 * no logic duplication. If the model changes, the backtest reflects it instantly.
 *
 * Methodology:
 *   - Randomly sample 100 tickers from a ~250-stock NASDAQ universe (seeded by run date)
 *   - Fetch 3 years of daily adjusted prices from Yahoo Finance
 *   - Walk-forward: first 504 trading days = calibration, next 252 = test period
 *   - GBM is used for the 12-month horizon (same as app: Bootstrap for ≤6mo, GBM for >6mo)
 *   - Compare predicted [bear p25, base p50, bull p75] against actual 12-month return
 *
 * Run: npm run test:backtest
 */

import { gbmPredict, clampScenario } from '../utils/models/gbmModel.js';

// ── Configuration ─────────────────────────────────────────────────────────────

const HORIZON_YEARS = 1;
const CALIBRATION_DAYS = 504; // ≈ 2 trading years
const TEST_DAYS = 252;        // ≈ 1 trading year
const TOTAL_DAYS_NEEDED = CALIBRATION_DAYS + TEST_DAYS; // ≈ 756 = 3 years
const SAMPLE_SIZE = 100;
const CONCURRENCY = 8;        // parallel Yahoo Finance requests
const FETCH_DELAY_MS = 150;   // ms between batches to avoid 429

// ── NASDAQ Universe (~260 liquid tickers) ────────────────────────────────────
// Diverse mix: mega-cap, semis, SaaS, biotech, consumer, fintech, ETFs, meme.
// We sample SAMPLE_SIZE randomly each run (seeded by date).

const NASDAQ_UNIVERSE: string[] = [
  // Mega-cap tech
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'ORCL', 'ADBE',
  // Semiconductors
  'AMD', 'INTC', 'QCOM', 'TXN', 'MU', 'AMAT', 'LRCX', 'KLAC', 'NXPI', 'MRVL', 'MCHP',
  // Internet & platforms
  'NFLX', 'PYPL', 'EBAY', 'BKNG', 'ABNB', 'UBER', 'LYFT', 'DASH', 'EXPE', 'TRIP', 'MTCH',
  // Cloud / enterprise SaaS
  'CRM', 'NOW', 'WDAY', 'INTU', 'TEAM', 'ANSS', 'CDNS', 'SNPS', 'MANH', 'VEEV', 'HUBS',
  // High-growth tech
  'SNOW', 'PLTR', 'CRWD', 'ZS', 'NET', 'DDOG', 'MDB', 'DOCN', 'BILL', 'PATH', 'GTLB',
  // Networking / hardware
  'CSCO', 'ANET', 'PALO', 'JNPR', 'FFIV', 'NTAP', 'PSTG', 'SMCI',
  // High-vol / speculative
  'GME', 'AMC', 'MSTR', 'RIVN', 'LCID', 'SPCE', 'BYND', 'PTON', 'CHWY', 'PARA',
  // Biotech & life sciences
  'AMGN', 'GILD', 'BIIB', 'MRNA', 'REGN', 'VRTX', 'ISRG', 'IDXX', 'ILMN', 'ALGN', 'SGEN',
  // Consumer & retail
  'COST', 'SBUX', 'LULU', 'MNST', 'CTAS', 'FAST', 'PAYX', 'ODFL', 'POOL', 'ULTA', 'ROST',
  // Fintech & financial
  'COIN', 'SQ', 'AFRM', 'SOFI', 'UPST', 'IBKR', 'HOOD', 'LPLA', 'MKTX', 'NDAQ', 'SSNC',
  // Media & communication
  'CMCSA', 'WBD', 'FOXA', 'FOX', 'NWSA', 'IPG',
  // ETFs & broad market (adds stable baselines for calibration reference)
  'QQQ', 'TQQQ', 'SQQQ', 'ARKK', 'XLK', 'XBI', 'IBB', 'SMH', 'SOXX', 'VGT',
  // Additional NASDAQ large/mid cap
  'ADSK', 'IDXX', 'MELI', 'PDD', 'JD', 'BIDU', 'ZM', 'OKTA', 'SPLK', 'TWLO',
  'ROKU', 'PINS', 'SNAP', 'TTD', 'PUBM', 'MGNI', 'APPS', 'IQ', 'NTES',
  'CSGP', 'CPRT', 'VRSK', 'ANSS', 'CBRE', 'DLTR', 'WBA', 'SIRI',
];

// Deduplicate
const TICKERS = [...new Set(NASDAQ_UNIVERSE)];

// ── Seeded PRNG (same mulberry32 as the app) ──────────────────────────────────

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleTickers(n: number, seed: number): string[] {
  const rng = mulberry32(seed);
  const pool = [...TICKERS];
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function dateSeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// ── Yahoo Finance fetch ───────────────────────────────────────────────────────

interface YahooResult {
  ticker: string;
  adjClose: number[];
}

async function fetchAdjClose(ticker: string): Promise<YahooResult | null> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}` +
    `?interval=1d&range=4y`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Njord-Backtest/1.0)',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) return null;

    const data = await res.json() as {
      chart: {
        result: Array<{
          indicators: {
            adjclose?: Array<{ adjclose: (number | null)[] }>;
            quote: Array<{ close: (number | null)[] }>;
          };
        }> | null;
        error?: { code: string };
      };
    };

    if (!data?.chart?.result?.length) return null;

    const result = data.chart.result[0];
    const rawPrices =
      result.indicators.adjclose?.[0]?.adjclose ??
      result.indicators.quote[0]?.close;

    if (!rawPrices) return null;

    // Filter out nulls
    const adjClose = rawPrices.filter((p): p is number => p !== null && isFinite(p));
    if (adjClose.length < TOTAL_DAYS_NEEDED) return null;

    return { ticker, adjClose };
  } catch {
    return null;
  }
}

async function fetchBatch(tickers: string[]): Promise<(YahooResult | null)[]> {
  return Promise.all(tickers.map(t => fetchAdjClose(t)));
}

async function fetchAll(tickers: string[]): Promise<YahooResult[]> {
  const results: YahooResult[] = [];
  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const batch = tickers.slice(i, i + CONCURRENCY);
    const batchResults = await fetchBatch(batch);
    results.push(...batchResults.filter((r): r is YahooResult => r !== null));
    if (i + CONCURRENCY < tickers.length) {
      await new Promise(resolve => setTimeout(resolve, FETCH_DELAY_MS));
    }
    process.stdout.write(`\r  Fetched ${Math.min(i + CONCURRENCY, tickers.length)}/${tickers.length} tickers...`);
  }
  process.stdout.write('\n');
  return results;
}

// ── Statistical helpers ───────────────────────────────────────────────────────

function logReturns(prices: number[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      ret.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return ret;
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// ── Backtest per stock ────────────────────────────────────────────────────────

interface BacktestResult {
  ticker: string;
  sigmaAnnual: number;    // annualized vol (%)
  muAnnual: number;       // annualized mean return (%)
  bear: number;           // p25 scenario (%)
  base: number;           // p50 scenario (%)
  bull: number;           // p75 scenario (%)
  actual: number;         // realized 12-month return (%)
  hit: boolean;           // actual in [bear, bull]
  zone: 'below_bear' | 'bear_base' | 'base_bull' | 'above_bull';
}

function backtest(stock: YahooResult): BacktestResult | null {
  const prices = stock.adjClose;
  if (prices.length < TOTAL_DAYS_NEEDED) return null;

  // Use last TOTAL_DAYS_NEEDED prices
  const window = prices.slice(prices.length - TOTAL_DAYS_NEEDED);
  const calibPrices = window.slice(0, CALIBRATION_DAYS + 1); // +1 to get all daily returns
  const testStart = window[CALIBRATION_DAYS];
  const testEnd = window[TOTAL_DAYS_NEEDED - 1];

  const dailyLogRet = logReturns(calibPrices);
  if (dailyLogRet.length < 50) return null;

  const sigmaDaily = stddev(dailyLogRet);
  const muDaily = mean(dailyLogRet);

  const sigmaAnnual = sigmaDaily * Math.sqrt(252);
  const muAnnual = muDaily * 252;

  // GBM prediction (same threshold as app: >6mo → GBM)
  const pred = gbmPredict(sigmaAnnual, muAnnual, CALIBRATION_DAYS / 252, HORIZON_YEARS);
  if (pred.confidence === 0) return null;

  const [, p25, p50, p75] = pred.percentiles;
  const bear = clampScenario(p25, HORIZON_YEARS);
  const base = clampScenario(p50, HORIZON_YEARS);
  const bull = clampScenario(p75, HORIZON_YEARS);

  const actual = (testEnd / testStart - 1) * 100;
  const hit = actual >= bear && actual <= bull;

  let zone: BacktestResult['zone'];
  if (actual < bear) zone = 'below_bear';
  else if (actual < base) zone = 'bear_base';
  else if (actual <= bull) zone = 'base_bull';
  else zone = 'above_bull';

  return {
    ticker: stock.ticker,
    sigmaAnnual: sigmaAnnual * 100,
    muAnnual: muAnnual * 100,
    bear,
    base,
    bull,
    actual,
    hit,
    zone,
  };
}

// ── Reporting ─────────────────────────────────────────────────────────────────

function fmt(n: number, digits = 1): string {
  return (n >= 0 ? '+' : '') + n.toFixed(digits) + '%';
}

function printReport(results: BacktestResult[]): void {
  const n = results.length;
  if (n === 0) {
    console.log('No results — all fetches failed.');
    return;
  }

  // Aggregate metrics
  const hits = results.filter(r => r.hit).length;
  const coverageRate = (hits / n) * 100;

  const zones = {
    below_bear: results.filter(r => r.zone === 'below_bear').length,
    bear_base:  results.filter(r => r.zone === 'bear_base').length,
    base_bull:  results.filter(r => r.zone === 'base_bull').length,
    above_bull: results.filter(r => r.zone === 'above_bull').length,
  };

  const bearSignOk = results.filter(r => r.bear < 0).length;
  const baseMAE = results.reduce((sum, r) => sum + Math.abs(r.base - r.actual), 0) / n;

  // Per-stock table
  const colW = [7, 8, 8, 8, 8, 8, 5];
  const header = ['TICKER', 'σ/yr', 'BEAR', 'BASE', 'BULL', 'ACTUAL', 'HIT']
    .map((h, i) => h.padStart(colW[i]))
    .join('  ');
  const sep = '-'.repeat(header.length);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' NJORD PREDICTION ENGINE — NASDAQ BACKTEST');
  console.log(` Run date: ${new Date().toISOString().slice(0, 10)}`);
  console.log(` Calibration: ${CALIBRATION_DAYS} trading days → predict ${HORIZON_YEARS * 12}-month return`);
  console.log(` Stocks processed: ${n}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(header);
  console.log(sep);

  const sorted = [...results].sort((a, b) => a.ticker.localeCompare(b.ticker));
  for (const r of sorted) {
    const row = [
      r.ticker.padStart(colW[0]),
      fmt(r.sigmaAnnual).padStart(colW[1]),
      fmt(r.bear).padStart(colW[2]),
      fmt(r.base).padStart(colW[3]),
      fmt(r.bull).padStart(colW[4]),
      fmt(r.actual).padStart(colW[5]),
      (r.hit ? '✓' : '✗').padStart(colW[6]),
    ].join('  ');
    console.log(row);
  }
  console.log(sep);

  // Summary
  console.log('\n── CALIBRATION METRICS ─────────────────────────────────────\n');
  console.log(`  Coverage rate (actual in [bear, bull]):    ${coverageRate.toFixed(1)}%`);
  console.log(`  Expected for well-calibrated p25/p75:      ~50%`);
  console.log(`  Verdict: ${
    coverageRate >= 45 && coverageRate <= 65
      ? '✓ GOOD — model is well-calibrated'
      : coverageRate > 65
        ? '⚠ WIDE — model is overconservative (range too broad)'
        : '✗ BAD — model is overconfident (range too narrow)'
  }\n`);

  console.log('  Quantile bucket distribution (ideal: ~25% each):');
  console.log(`    < bear:       ${zones.below_bear} stocks  (${(zones.below_bear / n * 100).toFixed(1)}%)  [expected ~25%]`);
  console.log(`    bear → base:  ${zones.bear_base} stocks  (${(zones.bear_base / n * 100).toFixed(1)}%)  [expected ~25%]`);
  console.log(`    base → bull:  ${zones.base_bull} stocks  (${(zones.base_bull / n * 100).toFixed(1)}%)  [expected ~25%]`);
  console.log(`    > bull:       ${zones.above_bull} stocks  (${(zones.above_bull / n * 100).toFixed(1)}%)  [expected ~25%]\n`);

  console.log(`  Bear sign accuracy (bear < 0):             ${(bearSignOk / n * 100).toFixed(1)}%  (should be 100%)`);
  console.log(`  Base scenario MAE vs actual:               ${baseMAE.toFixed(1)}pp`);
  console.log(`  Base scenario MAE context:                 ${
    baseMAE < 20
      ? '✓ Good (< 20pp on 12-month stock returns)'
      : baseMAE < 35
        ? '~ Acceptable (20–35pp is normal for 12-month equity forecasts)'
        : '✗ High (> 35pp — model drift may be off)'
  }`);

  console.log('\n── WORST MISSES ────────────────────────────────────────────\n');
  const misses = results
    .filter(r => !r.hit)
    .sort((a, b) => Math.abs(b.actual - (b.actual < b.bear ? b.bear : b.bull)) - Math.abs(a.actual - (a.actual < a.bear ? a.bear : a.bull)));
  for (const r of misses.slice(0, 10)) {
    const miss = r.actual < r.bear
      ? `actual ${fmt(r.actual)} was ${(r.bear - r.actual).toFixed(1)}pp below bear ${fmt(r.bear)}`
      : `actual ${fmt(r.actual)} was ${(r.actual - r.bull).toFixed(1)}pp above bull ${fmt(r.bull)}`;
    console.log(`  ${r.ticker.padEnd(6)}  ${miss}`);
  }
  console.log('');
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const seed = dateSeed();
  const tickers = sampleTickers(SAMPLE_SIZE, seed);

  console.log(`\nNjord NASDAQ Backtest — ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Seed: ${seed} | Sampled ${tickers.length} tickers from ${TICKERS.length}-stock universe`);
  console.log(`Fetching 4yr price history from Yahoo Finance...\n`);

  const stocks = await fetchAll(tickers);
  console.log(`\n  ${stocks.length} tickers had sufficient data (≥${TOTAL_DAYS_NEEDED} trading days)\n`);

  if (stocks.length === 0) {
    console.error('No data fetched — check network connectivity or Yahoo Finance availability.');
    process.exit(1);
  }

  const results = stocks.map(backtest).filter((r): r is BacktestResult => r !== null);
  printReport(results);
}

main().catch(err => {
  console.error('Backtest failed:', err);
  process.exit(1);
});
