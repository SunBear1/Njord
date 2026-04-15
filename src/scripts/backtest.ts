/**
 * NASDAQ Backtest — Walk-forward calibration test for the Njord prediction engine.
 *
 * Imports gbmPredict DIRECTLY from the production model — single source of truth,
 * no logic duplication. If the model changes, the backtest reflects it instantly.
 *
 * NOTE: This tests the RAW GBM percentiles (p25/p50/p75) directly from gbmPredict.
 * The app's UI applies additional post-processing via toScenarios() in
 * useHistoricalVolatility.ts (MIN_SCENARIO_SPREAD enforcer, FX correlation).
 * That pipeline is NOT tested here — this validates the core mathematical model.
 *
 * Methodology:
 *   - Randomly sample 100 tickers from a ~250-stock universe (seeded by run date)
 *   - Fetch 5 years of daily adjusted prices from Yahoo Finance
 *   - Walk-forward: first 504 trading days = calibration, next 252 = test period
 *   - GBM is used for the 12-month horizon (same as app: Bootstrap for ≤6mo, GBM for >6mo)
 *   - Compare predicted [bear p25, base p50, bull p75] against actual 12-month return
 *
 * Acceptance gates (any fail → exit 1):
 *   G1: Coverage rate ∈ [35%, 65%]  (p25/p75 should capture ~50%)
 *   G2: Bear sign accuracy ≥ 90%    (bear scenario must be negative)
 *   G3: Stocks processed ≥ 50       (statistical significance)
 *
 * Run: npm run test:backtest
 */

import { gbmPredict } from '../utils/models/gbmModel.js';

// ── Configuration ─────────────────────────────────────────────────────────────

const HORIZON_YEARS = 1;
const CALIBRATION_DAYS = 504; // ≈ 2 trading years
const TEST_DAYS = 252;        // ≈ 1 trading year
const TOTAL_DAYS_NEEDED = CALIBRATION_DAYS + TEST_DAYS; // ≈ 756 = 3 years
const SAMPLE_SIZE = 100;
const CONCURRENCY = 8;        // parallel Yahoo Finance requests
const FETCH_DELAY_MS = 150;   // ms between batches to avoid 429
const RETRY_DELAY_MS = 2000;  // backoff before retry on 429/5xx

// ── Acceptance Gates (exit 1 if ANY hard gate fails) ──────────────────────────

const GATES = {
  coverageMin: 35,   // G1: coverage rate must be ≥ 35%
  coverageMax: 65,   // G1: coverage rate must be ≤ 65%
  bearSignMin: 90,   // G2: bear sign accuracy must be ≥ 90%
  minStocks: 50,     // G3: at least 50 stocks processed
};

const WARNINGS = {
  maxBaseMAE: 75,      // W1: base MAE > 75pp is concerning
  maxBucketShare: 50,  // W2: any single quantile bucket > 50% is severe asymmetry
};

// ── NASDAQ / NYSE Universe (~250 liquid tickers) ─────────────────────────────
// Diverse mix across sectors and volatility profiles.
// We sample SAMPLE_SIZE randomly each run (seeded by date).

const NASDAQ_UNIVERSE: string[] = [
  // Mega-cap tech
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'ORCL', 'ADBE',
  // Semiconductors
  'AMD', 'INTC', 'QCOM', 'TXN', 'MU', 'AMAT', 'LRCX', 'KLAC', 'NXPI', 'MRVL', 'MCHP',
  'ON', 'SWKS', 'QRVO', 'MPWR', 'WOLF',
  // Internet & platforms
  'NFLX', 'PYPL', 'EBAY', 'BKNG', 'ABNB', 'UBER', 'LYFT', 'DASH', 'EXPE', 'TRIP', 'MTCH',
  'ETSY', 'W', 'SHOP', 'SE', 'GRAB', 'CPNG',
  // Cloud / enterprise SaaS
  'CRM', 'NOW', 'WDAY', 'INTU', 'TEAM', 'ANSS', 'CDNS', 'SNPS', 'MANH', 'VEEV', 'HUBS',
  'PANW', 'FTNT', 'SPLK', 'DDOG', 'ZM', 'OKTA', 'TWLO',
  // High-growth tech
  'SNOW', 'PLTR', 'CRWD', 'ZS', 'NET', 'MDB', 'DOCN', 'BILL', 'PATH', 'GTLB',
  'S', 'CFLT', 'ESTC', 'FRSH', 'DLO',
  // Networking / hardware / IT infrastructure
  'CSCO', 'ANET', 'PALO', 'JNPR', 'FFIV', 'NTAP', 'PSTG', 'SMCI', 'HPE', 'HPQ', 'DELL',
  // High-vol / speculative
  'GME', 'AMC', 'MSTR', 'RIVN', 'LCID', 'SPCE', 'BYND', 'PTON', 'CHWY', 'PARA',
  'SOFI', 'OPEN', 'WISH', 'BBAI', 'IONQ',
  // Biotech & life sciences
  'AMGN', 'GILD', 'BIIB', 'MRNA', 'REGN', 'VRTX', 'ISRG', 'IDXX', 'ILMN', 'ALGN',
  'DXCM', 'HOLX', 'BMRN', 'EXAS', 'RARE', 'NBIX', 'PCVX', 'ALNY',
  // Pharma (large cap, lower vol)
  'JNJ', 'PFE', 'MRK', 'ABBV', 'LLY', 'BMY', 'AZN', 'NVO',
  // Consumer & retail
  'COST', 'SBUX', 'LULU', 'MNST', 'CTAS', 'FAST', 'PAYX', 'ODFL', 'POOL', 'ULTA', 'ROST',
  'TGT', 'DG', 'DLTR', 'FIVE', 'DECK', 'CROX', 'TPR', 'RL',
  // Fintech & financial
  'COIN', 'SQ', 'AFRM', 'UPST', 'IBKR', 'HOOD', 'LPLA', 'MKTX', 'NDAQ', 'SSNC',
  'FIS', 'FISV', 'GPN', 'WEX', 'TOST',
  // Media & communication
  'CMCSA', 'WBD', 'FOXA', 'FOX', 'NWSA', 'IPG', 'DIS', 'ROKU', 'SPOT', 'RBLX',
  // Auto / EV / industrial tech
  'F', 'GM', 'TM', 'XPEV', 'NIO', 'LI', 'DKNG', 'CGNX', 'TER',
  // Cybersecurity
  'CRWD', 'ZS', 'OKTA', 'VRNS', 'TENB', 'QLYS', 'RPD', 'CYBR',
  // ETFs (stable baselines for calibration reference)
  'QQQ', 'TQQQ', 'SQQQ', 'ARKK', 'XLK', 'XBI', 'IBB', 'SMH', 'SOXX', 'VGT',
  'SPY', 'IWM', 'DIA', 'VOO', 'VTI', 'EEM', 'GLD', 'TLT',
  // Additional large/mid cap
  'ADSK', 'MELI', 'PDD', 'JD', 'BIDU',
  'PINS', 'SNAP', 'TTD', 'PUBM', 'MGNI', 'APPS', 'IQ', 'NTES',
  'CSGP', 'CPRT', 'VRSK', 'CBRE', 'WBA', 'SIRI',
  // Industrial / materials (low correlation to tech)
  'CAT', 'DE', 'HON', 'UNP', 'LMT', 'RTX', 'BA', 'GE',
  // Energy (diversification from tech)
  'XOM', 'CVX', 'COP', 'SLB', 'OXY', 'DVN', 'EOG',
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
    `?interval=1d&range=5y`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Njord-Backtest/1.0)',
          'Accept': 'application/json',
        },
      });

      // Retry on 429 or 5xx (once, with backoff)
      if ((res.status === 429 || res.status >= 500) && attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }

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
      if (attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      return null;
    }
  }
  return null;
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
  // gbmPredict already clamps percentiles internally via clampScenario
  const pred = gbmPredict(sigmaAnnual, muAnnual, CALIBRATION_DAYS / 252, HORIZON_YEARS);
  if (pred.confidence === 0) return null;

  const [, p25, p50, p75] = pred.percentiles;
  const bear = p25;
  const base = p50;
  const bull = p75;

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

function printReport(results: BacktestResult[]): boolean {
  const n = results.length;
  if (n === 0) {
    console.log('No results — all fetches failed.');
    return false;
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
  const bearSignPct = (bearSignOk / n) * 100;
  const baseMAE = results.reduce((sum, r) => sum + Math.abs(r.base - r.actual), 0) / n;
  const maxBucketPct = Math.max(
    zones.below_bear / n * 100,
    zones.bear_base / n * 100,
    zones.base_bull / n * 100,
    zones.above_bull / n * 100,
  );

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

  // Verdict is derived from G1 gate thresholds — never contradicts the gate result.
  const coverageVerdict =
    coverageRate >= 45 && coverageRate <= 55
      ? '✓ EXCELLENT — well-calibrated'
      : coverageRate >= GATES.coverageMin && coverageRate <= GATES.coverageMax
        ? '⚠ ACCEPTABLE — within gate, slight overconfidence'
        : coverageRate > GATES.coverageMax
          ? '✗ FAIL — model is overconservative (range too broad, G1 failed)'
          : '✗ FAIL — model is overconfident (range too narrow, G1 failed)';

  console.log(`  Verdict: ${coverageVerdict}\n`);

  console.log('  Quantile bucket distribution (ideal: ~25% each):');
  console.log(`    < bear:       ${zones.below_bear} stocks  (${(zones.below_bear / n * 100).toFixed(1)}%)  [expected ~25%]`);
  console.log(`    bear → base:  ${zones.bear_base} stocks  (${(zones.bear_base / n * 100).toFixed(1)}%)  [expected ~25%]`);
  console.log(`    base → bull:  ${zones.base_bull} stocks  (${(zones.base_bull / n * 100).toFixed(1)}%)  [expected ~25%]`);
  console.log(`    > bull:       ${zones.above_bull} stocks  (${(zones.above_bull / n * 100).toFixed(1)}%)  [expected ~25%]\n`);

  console.log(`  Bear sign accuracy (bear < 0):             ${bearSignPct.toFixed(1)}%  (should be 100%)`);
  console.log(`  Base scenario MAE vs actual:               ${baseMAE.toFixed(1)}pp`);

  // ── Directional Bias ────────────────────────────────────────────────────────
  console.log('\n── DIRECTIONAL BIAS ────────────────────────────────────────\n');

  const aboveBull  = zones.above_bull;
  const belowBear  = zones.below_bear;
  const biasRatio  = belowBear > 0 ? aboveBull / belowBear : Infinity;

  console.log(`  Misses above bull:  ${aboveBull} stocks  (${(aboveBull / n * 100).toFixed(1)}%)  [expected ~25%]`);
  console.log(`  Misses below bear:  ${belowBear} stocks  (${(belowBear / n * 100).toFixed(1)}%)  [expected ~25%]`);
  console.log(`  Above/Below ratio:  ${isFinite(biasRatio) ? biasRatio.toFixed(2) : '∞'}  (ideal: ~1.0)\n`);

  if (biasRatio > 2.0) {
    console.log('  ⚠ POSSIBLE DRIFT UNDERESTIMATION — significantly more misses above bull than below bear.');
    console.log('    Possible causes: (a) bull market period, (b) drift shrinkage too aggressive,');
    console.log('    (c) survivorship bias. Collect multiple runs across different market regimes');
    console.log('    before adjusting the model.\n');
  } else if (biasRatio < 0.5) {
    console.log('  ⚠ POSSIBLE DRIFT OVERESTIMATION — significantly more misses below bear than above bull.');
    console.log('    Possible causes: (a) bear market period, (b) drift prior too optimistic.');
    console.log('    Collect multiple runs before adjusting the model.\n');
  } else {
    console.log('  ✓ SYMMETRIC — no systematic directional bias detected.\n');
  }

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

  // ── Acceptance Gates ────────────────────────────────────────────────────────
  console.log('\n── ACCEPTANCE GATES ────────────────────────────────────────\n');

  const g1Pass = coverageRate >= GATES.coverageMin && coverageRate <= GATES.coverageMax;
  const g2Pass = bearSignPct >= GATES.bearSignMin;
  const g3Pass = n >= GATES.minStocks;
  const allGatesPass = g1Pass && g2Pass && g3Pass;

  console.log(`  G1  Coverage ∈ [${GATES.coverageMin}%, ${GATES.coverageMax}%]:     ${coverageRate.toFixed(1)}%   ${g1Pass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  G2  Bear sign ≥ ${GATES.bearSignMin}%:              ${bearSignPct.toFixed(1)}%   ${g2Pass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  G3  Stocks processed ≥ ${GATES.minStocks}:          ${n}      ${g3Pass ? '✓ PASS' : '✗ FAIL'}`);

  // Warnings (informational, don't affect exit code)
  const w1Warn = baseMAE > WARNINGS.maxBaseMAE;
  const w2Warn = maxBucketPct > WARNINGS.maxBucketShare;

  if (w1Warn || w2Warn) {
    console.log('\n  Warnings:');
    if (w1Warn) console.log(`  W1  Base MAE ≤ ${WARNINGS.maxBaseMAE}pp:              ${baseMAE.toFixed(1)}pp  ⚠ WARNING`);
    if (w2Warn) console.log(`  W2  Max bucket ≤ ${WARNINGS.maxBucketShare}%:           ${maxBucketPct.toFixed(1)}%   ⚠ WARNING`);
  }

  console.log(`\n  OVERALL: ${allGatesPass ? '✓ PASS' : '✗ FAIL'}\n`);

  return allGatesPass;
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const seed = dateSeed();
  const tickers = sampleTickers(SAMPLE_SIZE, seed);

  // Approximate calendar dates for the calibration / test windows.
  // Yahoo returns ~252 trading days per year; we use the last TOTAL_DAYS_NEEDED points.
  const now = new Date();
  const msPerTradingDay = 365.25 / 252 * 24 * 60 * 60 * 1000;
  const testStart  = new Date(now.getTime() - TEST_DAYS * msPerTradingDay);
  const calibStart = new Date(now.getTime() - TOTAL_DAYS_NEEDED * msPerTradingDay);
  const fmt2 = (d: Date) => d.toISOString().slice(0, 7); // YYYY-MM

  console.log(`\nNjord NASDAQ Backtest — ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Seed: ${seed} | Sampled ${tickers.length} tickers from ${TICKERS.length}-stock universe`);
  console.log(`Calibration window: ~${fmt2(calibStart)} → ~${fmt2(testStart)}`);
  console.log(`Test window:        ~${fmt2(testStart)} → ~${fmt2(now)}`);
  console.log(`Fetching 5yr price history from Yahoo Finance...\n`);

  const stocks = await fetchAll(tickers);
  console.log(`\n  ${stocks.length} tickers had sufficient data (≥${TOTAL_DAYS_NEEDED} trading days)\n`);

  if (stocks.length === 0) {
    console.error('No data fetched — check network connectivity or Yahoo Finance availability.');
    process.exit(1);
  }

  const results = stocks.map(backtest).filter((r): r is BacktestResult => r !== null);
  const passed = printReport(results);
  process.exit(passed ? 0 : 1);
}

main().catch(err => {
  console.error('Backtest failed:', err);
  process.exit(1);
});
