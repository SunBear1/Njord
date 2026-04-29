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
import { writeFileSync } from 'fs';

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

// ── Sector taxonomy ──────────────────────────────────────────────────────────

type Sector =
  | 'mega-tech' | 'semis' | 'internet' | 'cloud-saas' | 'high-growth'
  | 'networking' | 'speculative' | 'biotech' | 'pharma' | 'consumer'
  | 'fintech' | 'media' | 'auto-industrial' | 'cybersecurity' | 'etf'
  | 'energy';

const SECTOR_MAP: Record<string, Sector> = {
  // Mega-cap tech
  AAPL: 'mega-tech', MSFT: 'mega-tech', GOOGL: 'mega-tech', GOOG: 'mega-tech',
  AMZN: 'mega-tech', NVDA: 'mega-tech', META: 'mega-tech', TSLA: 'mega-tech',
  AVGO: 'mega-tech', ORCL: 'mega-tech', ADBE: 'mega-tech',
  // Semiconductors
  AMD: 'semis', INTC: 'semis', QCOM: 'semis', TXN: 'semis', MU: 'semis',
  AMAT: 'semis', LRCX: 'semis', KLAC: 'semis', NXPI: 'semis', MRVL: 'semis',
  MCHP: 'semis', ON: 'semis', SWKS: 'semis', QRVO: 'semis', MPWR: 'semis', WOLF: 'semis',
  // Internet & platforms
  NFLX: 'internet', PYPL: 'internet', EBAY: 'internet', BKNG: 'internet',
  ABNB: 'internet', UBER: 'internet', LYFT: 'internet', DASH: 'internet',
  EXPE: 'internet', TRIP: 'internet', MTCH: 'internet', ETSY: 'internet',
  W: 'internet', SHOP: 'internet', SE: 'internet', GRAB: 'internet', CPNG: 'internet',
  // Cloud / enterprise SaaS
  CRM: 'cloud-saas', NOW: 'cloud-saas', WDAY: 'cloud-saas', INTU: 'cloud-saas',
  TEAM: 'cloud-saas', ANSS: 'cloud-saas', CDNS: 'cloud-saas', SNPS: 'cloud-saas',
  MANH: 'cloud-saas', VEEV: 'cloud-saas', HUBS: 'cloud-saas', PANW: 'cloud-saas',
  FTNT: 'cloud-saas', SPLK: 'cloud-saas', DDOG: 'cloud-saas', ZM: 'cloud-saas',
  OKTA: 'cloud-saas', TWLO: 'cloud-saas',
  // High-growth tech
  SNOW: 'high-growth', PLTR: 'high-growth', CRWD: 'high-growth', ZS: 'high-growth',
  NET: 'high-growth', MDB: 'high-growth', DOCN: 'high-growth', BILL: 'high-growth',
  PATH: 'high-growth', GTLB: 'high-growth', S: 'high-growth', CFLT: 'high-growth',
  ESTC: 'high-growth', FRSH: 'high-growth', DLO: 'high-growth',
  // Networking / hardware / IT infrastructure
  CSCO: 'networking', ANET: 'networking', PALO: 'networking', JNPR: 'networking',
  FFIV: 'networking', NTAP: 'networking', PSTG: 'networking', SMCI: 'networking',
  HPE: 'networking', HPQ: 'networking', DELL: 'networking',
  // High-vol / speculative
  GME: 'speculative', AMC: 'speculative', MSTR: 'speculative', RIVN: 'speculative',
  LCID: 'speculative', SPCE: 'speculative', BYND: 'speculative', PTON: 'speculative',
  CHWY: 'speculative', PARA: 'speculative', SOFI: 'speculative', OPEN: 'speculative',
  WISH: 'speculative', BBAI: 'speculative', IONQ: 'speculative',
  // Biotech & life sciences
  AMGN: 'biotech', GILD: 'biotech', BIIB: 'biotech', MRNA: 'biotech',
  REGN: 'biotech', VRTX: 'biotech', ISRG: 'biotech', IDXX: 'biotech',
  ILMN: 'biotech', ALGN: 'biotech', DXCM: 'biotech', HOLX: 'biotech',
  BMRN: 'biotech', EXAS: 'biotech', RARE: 'biotech', NBIX: 'biotech',
  PCVX: 'biotech', ALNY: 'biotech',
  // Pharma
  JNJ: 'pharma', PFE: 'pharma', MRK: 'pharma', ABBV: 'pharma',
  LLY: 'pharma', BMY: 'pharma', AZN: 'pharma', NVO: 'pharma',
  // Consumer & retail
  COST: 'consumer', SBUX: 'consumer', LULU: 'consumer', MNST: 'consumer',
  CTAS: 'consumer', FAST: 'consumer', PAYX: 'consumer', ODFL: 'consumer',
  POOL: 'consumer', ULTA: 'consumer', ROST: 'consumer', TGT: 'consumer',
  DG: 'consumer', DLTR: 'consumer', FIVE: 'consumer', DECK: 'consumer',
  CROX: 'consumer', TPR: 'consumer', RL: 'consumer',
  // Fintech & financial
  COIN: 'fintech', SQ: 'fintech', AFRM: 'fintech', UPST: 'fintech',
  IBKR: 'fintech', HOOD: 'fintech', LPLA: 'fintech', MKTX: 'fintech',
  NDAQ: 'fintech', SSNC: 'fintech', FIS: 'fintech', FISV: 'fintech',
  GPN: 'fintech', WEX: 'fintech', TOST: 'fintech',
  // Media & communication
  CMCSA: 'media', WBD: 'media', FOXA: 'media', FOX: 'media', NWSA: 'media',
  IPG: 'media', DIS: 'media', ROKU: 'media', SPOT: 'media', RBLX: 'media',
  // Auto / EV / industrial tech
  F: 'auto-industrial', GM: 'auto-industrial', TM: 'auto-industrial',
  XPEV: 'auto-industrial', NIO: 'auto-industrial', LI: 'auto-industrial',
  DKNG: 'auto-industrial', CGNX: 'auto-industrial', TER: 'auto-industrial',
  // Cybersecurity (deduplicated — CRWD/ZS/OKTA also in cloud-saas/high-growth; primary = cybersecurity)
  VRNS: 'cybersecurity', TENB: 'cybersecurity', QLYS: 'cybersecurity',
  RPD: 'cybersecurity', CYBR: 'cybersecurity',
  // ETFs
  QQQ: 'etf', TQQQ: 'etf', SQQQ: 'etf', ARKK: 'etf', XLK: 'etf',
  XBI: 'etf', IBB: 'etf', SMH: 'etf', SOXX: 'etf', VGT: 'etf',
  SPY: 'etf', IWM: 'etf', DIA: 'etf', VOO: 'etf', VTI: 'etf',
  EEM: 'etf', GLD: 'etf', TLT: 'etf',
  // Additional large/mid cap
  ADSK: 'cloud-saas', MELI: 'internet', PDD: 'internet', JD: 'internet', BIDU: 'internet',
  PINS: 'media', SNAP: 'media', TTD: 'media', PUBM: 'media', MGNI: 'media',
  APPS: 'high-growth', IQ: 'media', NTES: 'internet',
  CSGP: 'cloud-saas', CPRT: 'consumer', VRSK: 'fintech', CBRE: 'consumer',
  WBA: 'consumer', SIRI: 'media',
  // Industrial / materials
  CAT: 'auto-industrial', DE: 'auto-industrial', HON: 'auto-industrial',
  UNP: 'auto-industrial', LMT: 'auto-industrial', RTX: 'auto-industrial',
  BA: 'auto-industrial', GE: 'auto-industrial',
  // Energy
  XOM: 'energy', CVX: 'energy', COP: 'energy', SLB: 'energy',
  OXY: 'energy', DVN: 'energy', EOG: 'energy',
};

function getSector(ticker: string): Sector {
  return SECTOR_MAP[ticker] ?? 'speculative';
}

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
  sector: Sector;
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
    sector: getSector(stock.ticker),
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

// ── Metrics record (written to backtest-metrics.json for CI time-series) ─────

interface RunMetrics {
  date: string;
  coverage_pct: number;
  above_bull_pct: number;
  below_bear_pct: number;
  bias_ratio: number;
  base_mae_pp: number;
  stocks: number;
  overall: 'PASS' | 'FAIL';
  regime: 'bull' | 'bear' | 'neutral';
  worst_sector: string;
  worst_sector_coverage_pct: number;
}

/** Per-miss detail for the miss log artifact */
interface MissDetail {
  ticker: string;
  sector: Sector;
  direction: 'above_bull' | 'below_bear';
  miss_pp: number;
  sigma: number;
}

/** Per-sector aggregated stats */
interface SectorStats {
  sector: Sector;
  count: number;
  hits: number;
  coveragePct: number;
  aboveBull: number;
  belowBear: number;
  biasRatio: number;
  mae: number;
}

// ── Reporting ─────────────────────────────────────────────────────────────────

function fmt(n: number, digits = 1): string {
  return (n >= 0 ? '+' : '') + n.toFixed(digits) + '%';
}

function computeSectorStats(results: BacktestResult[]): SectorStats[] {
  const grouped = new Map<Sector, BacktestResult[]>();
  for (const r of results) {
    const list = grouped.get(r.sector) ?? [];
    list.push(r);
    grouped.set(r.sector, list);
  }

  const stats: SectorStats[] = [];
  for (const [sector, items] of grouped) {
    const count = items.length;
    const hits = items.filter(r => r.hit).length;
    const aboveBull = items.filter(r => r.zone === 'above_bull').length;
    const belowBear = items.filter(r => r.zone === 'below_bear').length;
    const mae = items.reduce((s, r) => s + Math.abs(r.base - r.actual), 0) / count;
    stats.push({
      sector,
      count,
      hits,
      coveragePct: (hits / count) * 100,
      aboveBull,
      belowBear,
      biasRatio: belowBear > 0 ? aboveBull / belowBear : (aboveBull > 0 ? Infinity : 1),
      mae,
    });
  }
  return stats.sort((a, b) => a.coveragePct - b.coveragePct);
}

function buildMissLog(results: BacktestResult[]): MissDetail[] {
  return results
    .filter(r => !r.hit)
    .map(r => {
      const direction = r.actual < r.bear ? 'below_bear' as const : 'above_bull' as const;
      const missPp = direction === 'below_bear'
        ? r.bear - r.actual
        : r.actual - r.bull;
      return {
        ticker: r.ticker,
        sector: r.sector,
        direction,
        miss_pp: parseFloat(missPp.toFixed(1)),
        sigma: parseFloat(r.sigmaAnnual.toFixed(1)),
      };
    })
    .sort((a, b) => b.miss_pp - a.miss_pp);
}

function detectRegime(results: BacktestResult[]): 'bull' | 'bear' | 'neutral' {
  const spy = results.find(r => r.ticker === 'SPY');
  if (!spy) return 'neutral';
  if (spy.actual > 15) return 'bull';
  if (spy.actual < -10) return 'bear';
  return 'neutral';
}

function printReport(
  results: BacktestResult[],
): { passed: boolean; metrics: RunMetrics; misses: MissDetail[] } {
  const n = results.length;
  if (n === 0) {
    console.log('No results — all fetches failed.');
    const metrics: RunMetrics = {
      date: new Date().toISOString().slice(0, 10),
      coverage_pct: 0, above_bull_pct: 0, below_bear_pct: 0, bias_ratio: 0,
      base_mae_pp: 0, stocks: 0, overall: 'FAIL',
      regime: 'neutral', worst_sector: '', worst_sector_coverage_pct: 0,
    };
    return { passed: false, metrics, misses: [] };
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

  const regime = detectRegime(results);
  const sectorStats = computeSectorStats(results);
  const missLog = buildMissLog(results);
  const worstSector = sectorStats[0]; // sorted ascending by coverage

  // Per-stock table
  const colW = [7, 14, 8, 8, 8, 8, 8, 5];
  const header = ['TICKER', 'SECTOR', 'σ/yr', 'BEAR', 'BASE', 'BULL', 'ACTUAL', 'HIT']
    .map((h, i) => h.padStart(colW[i]))
    .join('  ');
  const sep = '-'.repeat(header.length);

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log(' NJORD PREDICTION ENGINE — NASDAQ BACKTEST');
  console.log(` Run date: ${new Date().toISOString().slice(0, 10)}`);
  console.log(` Calibration: ${CALIBRATION_DAYS} trading days → predict ${HORIZON_YEARS * 12}-month return`);
  console.log(` Stocks processed: ${n}`);
  console.log(` Market regime: ${regime.toUpperCase()}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log(header);
  console.log(sep);

  const sorted = [...results].sort((a, b) => a.ticker.localeCompare(b.ticker));
  for (const r of sorted) {
    const row = [
      r.ticker.padStart(colW[0]),
      r.sector.padStart(colW[1]),
      fmt(r.sigmaAnnual).padStart(colW[2]),
      fmt(r.bear).padStart(colW[3]),
      fmt(r.base).padStart(colW[4]),
      fmt(r.bull).padStart(colW[5]),
      fmt(r.actual).padStart(colW[6]),
      (r.hit ? '✓' : '✗').padStart(colW[7]),
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

  // ── Per-Sector Breakdown ──────────────────────────────────────────────────
  console.log('\n── PER-SECTOR BREAKDOWN ────────────────────────────────────\n');

  const sColW = [16, 6, 10, 10, 10, 8];
  const sHeader = ['SECTOR', 'N', 'COVERAGE', 'ABOVE_BULL', 'BELOW_BEAR', 'MAE']
    .map((h, i) => h.padStart(sColW[i]))
    .join('  ');
  console.log(sHeader);
  console.log('-'.repeat(sHeader.length));

  for (const s of sectorStats) {
    const row = [
      s.sector.padStart(sColW[0]),
      String(s.count).padStart(sColW[1]),
      (s.coveragePct.toFixed(1) + '%').padStart(sColW[2]),
      ((s.aboveBull / s.count * 100).toFixed(1) + '%').padStart(sColW[3]),
      ((s.belowBear / s.count * 100).toFixed(1) + '%').padStart(sColW[4]),
      (s.mae.toFixed(1) + 'pp').padStart(sColW[5]),
    ].join('  ');
    console.log(row);
  }

  if (worstSector) {
    console.log(`\n  Worst sector: ${worstSector.sector} (coverage ${worstSector.coveragePct.toFixed(1)}%, n=${worstSector.count})`);
  }

  // ── Directional Bias ────────────────────────────────────────────────────────
  console.log('\n── DIRECTIONAL BIAS ────────────────────────────────────────\n');

  const aboveBull  = zones.above_bull;
  const belowBear  = zones.below_bear;
  const biasRatio  = belowBear > 0 ? aboveBull / belowBear : Infinity;

  console.log(`  Misses above bull:  ${aboveBull} stocks  (${(aboveBull / n * 100).toFixed(1)}%)  [expected ~25%]`);
  console.log(`  Misses below bear:  ${belowBear} stocks  (${(belowBear / n * 100).toFixed(1)}%)  [expected ~25%]`);
  console.log(`  Above/Below ratio:  ${isFinite(biasRatio) ? biasRatio.toFixed(2) : '∞'}  (ideal: ~1.0)`);
  console.log(`  Market regime:      ${regime.toUpperCase()}\n`);

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
  for (const m of missLog.slice(0, 10)) {
    const dirLabel = m.direction === 'below_bear' ? 'below bear' : 'above bull';
    console.log(`  ${m.ticker.padEnd(6)}  [${m.sector.padEnd(14)}]  ${m.miss_pp.toFixed(1)}pp ${dirLabel}  (σ=${m.sigma.toFixed(1)}%)`);
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

  const metrics: RunMetrics = {
    date: new Date().toISOString().slice(0, 10),
    coverage_pct: parseFloat(coverageRate.toFixed(1)),
    above_bull_pct: parseFloat((aboveBull / n * 100).toFixed(1)),
    below_bear_pct: parseFloat((belowBear / n * 100).toFixed(1)),
    bias_ratio: parseFloat((isFinite(biasRatio) ? biasRatio : 0).toFixed(2)),
    base_mae_pp: parseFloat(baseMAE.toFixed(1)),
    stocks: n,
    overall: allGatesPass ? 'PASS' : 'FAIL',
    regime,
    worst_sector: worstSector?.sector ?? '',
    worst_sector_coverage_pct: parseFloat((worstSector?.coveragePct ?? 0).toFixed(1)),
  };

  return { passed: allGatesPass, metrics, misses: missLog };
}

// ── Max-vol experiment ────────────────────────────────────────────────────────
// Runs GBM with max(σ₂yr, σ₆m) and compares coverage side-by-side.

interface MaxVolResult {
  ticker: string;
  sigma2yr: number;
  sigma6m: number;
  sigmaUsed: number;
  bear: number;
  bull: number;
  actual: number;
  hit: boolean;
}

function backtestMaxVol(stock: YahooResult): MaxVolResult | null {
  const prices = stock.adjClose;
  if (prices.length < TOTAL_DAYS_NEEDED) return null;

  const window = prices.slice(prices.length - TOTAL_DAYS_NEEDED);
  const calibPrices = window.slice(0, CALIBRATION_DAYS + 1);
  const testStart = window[CALIBRATION_DAYS];
  const testEnd = window[TOTAL_DAYS_NEEDED - 1];

  const dailyLogRet = logReturns(calibPrices);
  if (dailyLogRet.length < 50) return null;

  const sigma2yr = stddev(dailyLogRet) * Math.sqrt(252);
  const muAnnual = mean(dailyLogRet) * 252;

  // 6-month vol: last 126 trading days of calibration window
  const recent = dailyLogRet.slice(-126);
  const sigma6m = recent.length >= 50 ? stddev(recent) * Math.sqrt(252) : sigma2yr;

  const sigmaUsed = Math.max(sigma2yr, sigma6m);

  const pred = gbmPredict(sigmaUsed, muAnnual, CALIBRATION_DAYS / 252, HORIZON_YEARS);
  if (pred.confidence === 0) return null;

  const [, p25, , p75] = pred.percentiles;
  const actual = (testEnd / testStart - 1) * 100;

  return {
    ticker: stock.ticker,
    sigma2yr: sigma2yr * 100,
    sigma6m: sigma6m * 100,
    sigmaUsed: sigmaUsed * 100,
    bear: p25,
    bull: p75,
    actual,
    hit: actual >= p25 && actual <= p75,
  };
}

function printMaxVolComparison(standardResults: BacktestResult[], stocks: YahooResult[]): void {
  const maxVolResults = stocks
    .map(backtestMaxVol)
    .filter((r): r is MaxVolResult => r !== null);

  if (maxVolResults.length === 0) return;

  const standardCoverage = (standardResults.filter(r => r.hit).length / standardResults.length) * 100;
  const maxVolCoverage = (maxVolResults.filter(r => r.hit).length / maxVolResults.length) * 100;

  const standardAboveBull = standardResults.filter(r => r.zone === 'above_bull').length;
  const standardBelowBear = standardResults.filter(r => r.zone === 'below_bear').length;

  const mvAboveBull = maxVolResults.filter(r => r.actual > r.bull).length;
  const mvBelowBear = maxVolResults.filter(r => r.actual < r.bear).length;

  console.log('\n── MAX-VOL EXPERIMENT: max(σ₂yr, σ₆m) ─────────────────────\n');
  console.log('  Comparison: standard 2yr vol vs max(2yr, 6m) vol');
  console.log('  NOTE: Experiment only — does NOT change production model.\n');

  const lw = 24;
  console.log(`  ${'Metric'.padEnd(lw)}  ${'Standard'.padStart(10)}  ${'Max-Vol'.padStart(10)}`);
  console.log(`  ${'-'.repeat(lw)}  ${'-'.repeat(10)}  ${'-'.repeat(10)}`);
  console.log(`  ${'Coverage'.padEnd(lw)}  ${(standardCoverage.toFixed(1) + '%').padStart(10)}  ${(maxVolCoverage.toFixed(1) + '%').padStart(10)}`);
  console.log(`  ${'Above bull (misses)'.padEnd(lw)}  ${String(standardAboveBull).padStart(10)}  ${String(mvAboveBull).padStart(10)}`);
  console.log(`  ${'Below bear (misses)'.padEnd(lw)}  ${String(standardBelowBear).padStart(10)}  ${String(mvBelowBear).padStart(10)}`);
  console.log(`  ${'Stocks'.padEnd(lw)}  ${String(standardResults.length).padStart(10)}  ${String(maxVolResults.length).padStart(10)}`);

  // Show tickers where 6m vol > 2yr vol (regime-adaptive widening happened)
  const widened = maxVolResults.filter(r => r.sigma6m > r.sigma2yr);
  if (widened.length > 0) {
    console.log(`\n  Tickers where σ₆m > σ₂yr (${widened.length} / ${maxVolResults.length}):`);
    for (const r of widened.slice(0, 15)) {
      const delta = r.sigma6m - r.sigma2yr;
      console.log(`    ${r.ticker.padEnd(6)}  σ₂yr=${r.sigma2yr.toFixed(1)}%  σ₆m=${r.sigma6m.toFixed(1)}%  (Δ=${delta.toFixed(1)}pp)  hit=${r.hit ? '✓' : '✗'}`);
    }
    if (widened.length > 15) console.log(`    ... and ${widened.length - 15} more`);
  }
  console.log('');
}

// ── Multi-window backtest ─────────────────────────────────────────────────────

interface WindowConfig {
  label: string;
  offsetDays: number; // shift calibration + test window back by this many trading days
}

const MULTI_WINDOWS: WindowConfig[] = [
  { label: 'latest', offsetDays: 0 },
  { label: '1yr-ago', offsetDays: 252 },
  { label: '2yr-ago', offsetDays: 504 },
];

function backtestWindow(stock: YahooResult, offsetDays: number): BacktestResult | null {
  const prices = stock.adjClose;
  const needed = TOTAL_DAYS_NEEDED + offsetDays;
  if (prices.length < needed) return null;

  const window = prices.slice(prices.length - needed, prices.length - offsetDays);
  if (window.length < TOTAL_DAYS_NEEDED) return null;

  const calibPrices = window.slice(0, CALIBRATION_DAYS + 1);
  const testStart = window[CALIBRATION_DAYS];
  const testEnd = window[TOTAL_DAYS_NEEDED - 1];

  const dailyLogRet = logReturns(calibPrices);
  if (dailyLogRet.length < 50) return null;

  const sigmaDaily = stddev(dailyLogRet);
  const muDaily = mean(dailyLogRet);
  const sigmaAnnual = sigmaDaily * Math.sqrt(252);
  const muAnnual = muDaily * 252;

  const pred = gbmPredict(sigmaAnnual, muAnnual, CALIBRATION_DAYS / 252, HORIZON_YEARS);
  if (pred.confidence === 0) return null;

  const [, p25, p50, p75] = pred.percentiles;
  const actual = (testEnd / testStart - 1) * 100;
  const hit = actual >= p25 && actual <= p75;

  let zone: BacktestResult['zone'];
  if (actual < p25) zone = 'below_bear';
  else if (actual < p50) zone = 'bear_base';
  else if (actual <= p75) zone = 'base_bull';
  else zone = 'above_bull';

  return {
    ticker: stock.ticker,
    sector: getSector(stock.ticker),
    sigmaAnnual: sigmaAnnual * 100,
    muAnnual: muAnnual * 100,
    bear: p25,
    base: p50,
    bull: p75,
    actual,
    hit,
    zone,
  };
}

function printMultiWindowComparison(stocks: YahooResult[]): void {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log(' MULTI-WINDOW COMPARISON — "Is this always bad or just now?"');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const lw = 24;
  const colHeaders = MULTI_WINDOWS.map(w => w.label);
  console.log(`  ${'Metric'.padEnd(lw)}  ${colHeaders.map(h => h.padStart(12)).join('  ')}`);
  console.log(`  ${'-'.repeat(lw)}  ${colHeaders.map(() => '-'.repeat(12)).join('  ')}`);

  const windowResults = MULTI_WINDOWS.map(w => {
    const results = stocks
      .map(s => backtestWindow(s, w.offsetDays))
      .filter((r): r is BacktestResult => r !== null);
    const n = results.length;
    const coverage = n > 0 ? (results.filter(r => r.hit).length / n) * 100 : 0;
    const aboveBull = n > 0 ? results.filter(r => r.zone === 'above_bull').length : 0;
    const belowBear = n > 0 ? results.filter(r => r.zone === 'below_bear').length : 0;
    const biasRatio = belowBear > 0 ? aboveBull / belowBear : (aboveBull > 0 ? Infinity : 1);
    const baseMAE = n > 0 ? results.reduce((s, r) => s + Math.abs(r.base - r.actual), 0) / n : 0;
    const regime = detectRegime(results);
    return { label: w.label, n, coverage, aboveBull, belowBear, biasRatio, baseMAE, regime };
  });

  const metrics = [
    { name: 'Stocks', fn: (w: typeof windowResults[0]) => String(w.n) },
    { name: 'Coverage', fn: (w: typeof windowResults[0]) => w.coverage.toFixed(1) + '%' },
    { name: 'Above bull', fn: (w: typeof windowResults[0]) => String(w.aboveBull) },
    { name: 'Below bear', fn: (w: typeof windowResults[0]) => String(w.belowBear) },
    { name: 'Bias ratio', fn: (w: typeof windowResults[0]) => isFinite(w.biasRatio) ? w.biasRatio.toFixed(2) : '∞' },
    { name: 'Base MAE', fn: (w: typeof windowResults[0]) => w.baseMAE.toFixed(1) + 'pp' },
    { name: 'Regime', fn: (w: typeof windowResults[0]) => w.regime },
  ];

  for (const m of metrics) {
    const vals = windowResults.map(w => m.fn(w).padStart(12));
    console.log(`  ${m.name.padEnd(lw)}  ${vals.join('  ')}`);
  }
  console.log('');
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const multiWindowMode = process.argv.includes('--windows');
  const seed = dateSeed();
  let tickers = sampleTickers(SAMPLE_SIZE, seed);

  // Force-include SPY for regime detection
  if (!tickers.includes('SPY')) {
    tickers = ['SPY', ...tickers.slice(0, SAMPLE_SIZE - 1)];
  }

  // Approximate calendar dates for the calibration / test windows.
  // Yahoo returns ~252 trading days per year; we use the last TOTAL_DAYS_NEEDED points.
  const now = new Date();
  const msPerTradingDay = 365.25 / 252 * 24 * 60 * 60 * 1000;
  const testStart  = new Date(now.getTime() - TEST_DAYS * msPerTradingDay);
  const calibStart = new Date(now.getTime() - TOTAL_DAYS_NEEDED * msPerTradingDay);
  const fmtDate = (d: Date) => d.toISOString().slice(0, 7); // YYYY-MM

  console.log(`\nNjord NASDAQ Backtest — ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Seed: ${seed} | Sampled ${tickers.length} tickers from ${TICKERS.length}-stock universe`);
  console.log(`Calibration window: ~${fmtDate(calibStart)} → ~${fmtDate(testStart)}`);
  console.log(`Test window:        ~${fmtDate(testStart)} → ~${fmtDate(now)}`);
  if (multiWindowMode) console.log(`Mode: MULTI-WINDOW (latest + 1yr-ago + 2yr-ago)`);
  console.log(`Fetching 5yr price history from Yahoo Finance...\n`);

  const stocks = await fetchAll(tickers);
  console.log(`\n  ${stocks.length} tickers had sufficient data (≥${TOTAL_DAYS_NEEDED} trading days)\n`);

  if (stocks.length === 0) {
    console.error('No data fetched — check network connectivity or Yahoo Finance availability.');
    process.exit(1);
  }

  const results = stocks.map(backtest).filter((r): r is BacktestResult => r !== null);
  const { passed, metrics, misses } = printReport(results);

  // Max-vol experiment (always runs — informational only)
  printMaxVolComparison(results, stocks);

  // Multi-window comparison (only when --windows flag is passed)
  if (multiWindowMode) {
    printMultiWindowComparison(stocks);
  }

  // Write machine-readable metrics for CI time-series tracking.
  // The workflow reads this file and appends a row to backtest-history.csv.
  writeFileSync('backtest-metrics.json', JSON.stringify(metrics, null, 2));

  // Write miss log for CI artifact upload
  writeFileSync('backtest-misses.json', JSON.stringify(misses, null, 2));

  process.exit(passed ? 0 : 1);
}

main().catch(err => {
  console.error('Backtest failed:', err);
  process.exit(1);
});
