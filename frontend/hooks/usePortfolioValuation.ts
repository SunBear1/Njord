import { useEffect, useState } from 'react';
import type { Holding, StockHolding } from '../types/holding';
import type { BondPreset } from '../types/scenario';
import { calcBondHoldingCurrentValue, calcSavingsHoldingCurrentValue } from '../utils/holdingValue';
import { fetchNbpTableARate } from '../utils/fetchNbpTableARate';

export interface PortfolioValuation {
  stockValuePLN: number;
  bondValuePLN: number;
  savingsValuePLN: number;
  totalPLN: number;
  isConverting: boolean;
  conversionError: string | null;
}

interface FxResolution {
  key: string;
  rates: Record<string, number>;
  error: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Distinct non-PLN currencies across stock holdings, sorted — one FX call per entry, never per ticker. */
export function distinctNonPlnCurrencies(stockHoldings: StockHolding[]): string[] {
  return [...new Set(stockHoldings.filter((h) => h.currency !== 'PLN').map((h) => h.currency))].sort();
}

/** Cost-basis value (quantity × avgPrice) of stock holdings converted to PLN; skips currencies with no resolved rate yet. */
export function calcStockHoldingsValuePLN(stockHoldings: StockHolding[], rates: Record<string, number>): number {
  return stockHoldings.reduce((sum, h) => {
    const rate = h.currency === 'PLN' ? 1 : rates[h.currency];
    if (rate === undefined) return sum;
    return sum + h.quantity * h.avgPrice * rate;
  }, 0);
}

export function usePortfolioValuation(holdings: Holding[], bondPresets: BondPreset[]): PortfolioValuation {
  const stockHoldings = holdings.filter((h): h is StockHolding => h.assetClass === 'stock');
  const nonPlnCurrencies = distinctNonPlnCurrencies(stockHoldings);
  const currencyKey = nonPlnCurrencies.join(',');

  const [fxResolution, setFxResolution] = useState<FxResolution>({ key: '', rates: {}, error: null });

  useEffect(() => {
    if (nonPlnCurrencies.length === 0) return;
    let cancelled = false;

    Promise.allSettled(
      nonPlnCurrencies.map((currency) => fetchNbpTableARate(todayIso(), currency)),
    ).then((results) => {
      if (cancelled) return;
      const rates: Record<string, number> = {};
      let hadFailure = false;
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          rates[nonPlnCurrencies[i]] = result.value.rate;
        } else {
          hadFailure = true;
        }
      });
      setFxResolution({
        key: currencyKey,
        rates,
        error: hadFailure ? 'Nie udało się pobrać kursu dla części walut — wartość akcji może być zaniżona.' : null,
      });
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currencyKey is the stable primitive form of nonPlnCurrencies
  }, [currencyKey]);

  const isConverting = nonPlnCurrencies.length > 0 && fxResolution.key !== currencyKey;
  const conversionError = fxResolution.key === currencyKey ? fxResolution.error : null;

  const stockValuePLN = calcStockHoldingsValuePLN(stockHoldings, fxResolution.rates);

  const bondValuePLN = holdings
    .filter((h): h is Extract<Holding, { assetClass: 'bond' }> => h.assetClass === 'bond')
    .reduce((sum, h) => {
      const preset = bondPresets.find((p) => p.id === h.bondPresetId);
      return preset ? sum + calcBondHoldingCurrentValue(h, preset) : sum;
    }, 0);

  const savingsValuePLN = holdings
    .filter((h): h is Extract<Holding, { assetClass: 'savings' }> => h.assetClass === 'savings')
    .reduce((sum, h) => sum + calcSavingsHoldingCurrentValue(h), 0);

  return {
    stockValuePLN,
    bondValuePLN,
    savingsValuePLN,
    totalPLN: stockValuePLN + bondValuePLN + savingsValuePLN,
    isConverting,
    conversionError,
  };
}
