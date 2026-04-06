import { useState, useCallback, useRef } from 'react';
import { HowItWorks } from './components/HowItWorks';
import { InputPanel } from './components/InputPanel';
import { ScenarioEditor } from './components/ScenarioEditor';
import { VerdictBanner } from './components/VerdictBanner';
import { ComparisonChart } from './components/ComparisonChart';
import { TimelineChart } from './components/TimelineChart';
import { BreakevenChart } from './components/BreakevenChart';
import { MethodologyPanel } from './components/MethodologyPanel';
import { useAssetData } from './hooks/useAssetData';
import { useFxData } from './hooks/useFxData';
import { useInflationData } from './hooks/useInflationData';
import { useHistoricalVolatility } from './hooks/useHistoricalVolatility';
import {
  calcAllScenarios,
  calcTimeline,
  calcHeatmap,
} from './utils/calculations';
import { DEFAULT_HORIZON_MONTHS } from './utils/assetConfig';
import type { Scenarios, ScenarioKey, BenchmarkType, BondRateType } from './types/scenario';
import { Anchor } from 'lucide-react';

const DEFAULT_SCENARIOS: Scenarios = {
  bear: { deltaStock: -10, deltaFx: -5 },
  base: { deltaStock: 0, deltaFx: 0 },
  bull: { deltaStock: 10, deltaFx: 5 },
};

const STORAGE_KEY_API = 'njord_twelve_data_api_key';
const BUILT_IN_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY || '';

function App() {
  const [ticker, setTicker] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY_API) || BUILT_IN_KEY);
  const [shares, setShares] = useState(0);
  const [currentPriceUSD, setCurrentPriceUSD] = useState(0);
  const [currentFxRate, setCurrentFxRate] = useState(0);
  const [wibor3m, setWibor3m] = useState(0);
  const [benchmarkType, setBenchmarkType] = useState<BenchmarkType>('savings');
  const [bondFirstYearRate, setBondFirstYearRate] = useState(2.00);
  const [bondPenalty, setBondPenalty] = useState(0);
  const [bondRateType, setBondRateType] = useState<BondRateType>('fixed');
  const [bondMargin, setBondMargin] = useState(0);
  const [inflationRate, setInflationRate] = useState(0);
  const [nbpRefRate, setNbpRefRate] = useState(0);
  const [horizonMonths, setHorizonMonths] = useState(DEFAULT_HORIZON_MONTHS);
  const [scenarios, setScenarios] = useState<Scenarios>(DEFAULT_SCENARIOS);
  const [scenarioEditKey, setScenarioEditKey] = useState(0);
  const fxAutoFilled = useRef(false);
  const inflationAutoFilled = useRef(false);

  const handleApiKeyChange = useCallback((key: string) => {
    setApiKey(key);
    localStorage.setItem(STORAGE_KEY_API, key);
  }, []);

  const { assetData, isLoading: assetLoading, error: assetError, fetchData: fetchAsset } = useAssetData();
  const { fxData, isLoading: fxLoading } = useFxData((data) => {
    if (!fxAutoFilled.current) {
      fxAutoFilled.current = true;
      setCurrentFxRate(data.currentRate);
    }
  });
  const { data: inflationData, isLoading: inflationLoading } = useInflationData((d) => {
    if (!inflationAutoFilled.current) {
      inflationAutoFilled.current = true;
      setInflationRate(d.rate);
    }
  });
  const { suggestedScenarios, stats: volatilityStats } = useHistoricalVolatility(
    assetData?.historicalPrices ?? null,
    fxData?.historicalRates ?? null,
    horizonMonths,
  );

  const fetchData = useCallback(async (ticker: string) => {
    const data = await fetchAsset(ticker, apiKey);
    if (data?.asset.currentPrice) {
      setCurrentPriceUSD(data.asset.currentPrice);
    }
  }, [fetchAsset, apiKey]);

  const handleScenarioChange = useCallback(
    (key: ScenarioKey, field: 'deltaStock' | 'deltaFx', value: number) => {
      setScenarios((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    },
    [],
  );

  const handleApplySuggested = useCallback(() => {
    if (suggestedScenarios) {
      setScenarios(suggestedScenarios);
      setScenarioEditKey((k) => k + 1);
    }
  }, [suggestedScenarios]);

  // Compute effective bond rate based on type + external data
  const computedEffectiveRate = bondRateType === 'fixed'
    ? bondFirstYearRate
    : bondRateType === 'reference'
      ? nbpRefRate + bondMargin
      : inflationRate + bondMargin;

  const calcInputs = {
    shares,
    currentPriceUSD,
    currentFxRate,
    wibor3mPercent: wibor3m,
    horizonMonths,
    benchmarkType,
    bondFirstYearRate,
    bondEffectiveRate: computedEffectiveRate,
    bondPenaltyPercent: bondPenalty,
  };

  const benchmarkReady = benchmarkType === 'savings' ? wibor3m > 0 : bondFirstYearRate > 0;
  const canCalc = shares > 0 && currentPriceUSD > 0 && currentFxRate > 0 && horizonMonths > 0 && benchmarkReady;

  const results = canCalc ? calcAllScenarios(calcInputs, scenarios) : null;
  const timeline = canCalc ? calcTimeline(calcInputs, scenarios) : null;
  const heatmap = canCalc ? calcHeatmap(calcInputs) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center gap-3">
          <Anchor size={28} className="text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Njord</h1>
            <p className="text-sm text-slate-400">Kalkulator: akcje vs. konto oszczędnościowe / obligacje skarbowe</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <HowItWorks />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InputPanel
            onFetchAsset={fetchData}
            assetData={assetData}
            assetLoading={assetLoading}
            assetError={assetError}
            fxData={fxData}
            fxLoading={fxLoading}
            ticker={ticker}
            apiKey={apiKey}
            shares={shares}
            currentPriceUSD={currentPriceUSD}
            currentFxRate={currentFxRate}
            wibor3m={wibor3m}
            horizonMonths={horizonMonths}
            benchmarkType={benchmarkType}
            bondFirstYearRate={bondFirstYearRate}
            bondEffectiveRate={computedEffectiveRate}
            bondPenalty={bondPenalty}
            bondRateType={bondRateType}
            bondMargin={bondMargin}
            inflationRate={inflationRate}
            inflationData={inflationData}
            inflationLoading={inflationLoading}
            nbpRefRate={nbpRefRate}
            onTickerChange={setTicker}
            onApiKeyChange={handleApiKeyChange}
            onSharesChange={setShares}
            onPriceChange={setCurrentPriceUSD}
            onFxRateChange={setCurrentFxRate}
            onWiborChange={setWibor3m}
            onHorizonChange={setHorizonMonths}
            onBenchmarkTypeChange={setBenchmarkType}
            onBondFirstYearRateChange={setBondFirstYearRate}
            onBondPenaltyChange={setBondPenalty}
            onBondRateTypeChange={setBondRateType}
            onBondMarginChange={setBondMargin}
            onInflationRateChange={setInflationRate}
            onNbpRefRateChange={setNbpRefRate}
          />
          <ScenarioEditor
            key={scenarioEditKey}
            scenarios={scenarios}
            onChange={handleScenarioChange}
            suggestedScenarios={suggestedScenarios}
            onApplySuggested={handleApplySuggested}
            currentPriceUSD={currentPriceUSD}
            currentFxRate={currentFxRate}
            volatilityStats={volatilityStats}
          />
        </div>

        {!canCalc && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 space-y-2">
            <p className="text-lg">Uzupełnij dane wejściowe, aby zobaczyć wyniki</p>
            <p className="text-sm">Wpisz ticker, liczbę akcji i oprocentowanie {benchmarkType === 'bonds' ? 'obligacji' : 'konta oszczędnościowego'}.</p>
          </div>
        )}

        {results && (
          <>
            <VerdictBanner results={results} />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ComparisonChart results={results} />
              {timeline && (
                <TimelineChart
                  data={timeline}
                  currentValuePLN={results[0]?.currentValuePLN ?? 0}
                  benchmarkLabel={results[0]?.benchmarkLabel ?? 'Konto'}
                />
              )}
            </div>
            {heatmap && (
              <BreakevenChart
                cells={heatmap}
                benchmarkEndValuePLN={results[0]?.benchmarkEndValuePLN ?? 0}
                benchmarkLabel={results[0]?.benchmarkLabel ?? 'Konto'}
              />
            )}
          </>
        )}

        <MethodologyPanel />
      </main>

      <footer className="border-t border-gray-200 mt-10 py-5 text-center text-xs text-gray-400">
        Njord — wyłącznie do celów edukacyjnych. Nie stanowi doradztwa inwestycyjnego.
      </footer>
    </div>
  );
}

export default App;
