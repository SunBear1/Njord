import { describe, expect, it } from 'vitest';
import type { ScenarioResult } from '../types/scenario';
import {
  formatScenarioList,
  getBaseResult,
  getDecisionSummary,
  getScenarioConsistencyText,
  getWinnerVerb,
} from '../utils/comparisonDecision';

function createScenarioResult(
  key: ScenarioResult['key'],
  overrides: Partial<ScenarioResult> = {},
): ScenarioResult {
  return {
    key,
    label: key,
    currentValuePLN: 10_000,
    stockRawEndValuePLN: 10_500,
    stockNetEndValuePLN: 10_300,
    benchmarkEndValuePLN: 10_800,
    stockBeatsBenchmark: false,
    differencePLN: -500,
    differencePercent: -4.9,
    stockReturnNet: 3,
    benchmarkReturnNet: 8,
    benchmarkLabel: 'ETF',
    stockRealReturnNet: 0.2,
    benchmarkRealReturnNet: 5.1,
    inflationTotalPercent: 6.5,
    costBasisValuePLN: 9_000,
    unrealizedGainPLN: 1_000,
    unrealizedGainPercent: 11.1,
    belkaTaxedFromCostBasis: true,
    dividendsNetPLN: 0,
    ...overrides,
  };
}

describe('comparisonDecision', () => {
  it('TestGetWinnerVerb_WhenWinnerIsEtf_ExpectsSingularVerb', () => {
    expect(getWinnerVerb('ETF')).toBe('wygrywa');
  });

  it('TestGetWinnerVerb_WhenWinnerIsBonds_ExpectsPluralVerb', () => {
    expect(getWinnerVerb('Obligacje')).toBe('wygrywają');
  });

  it('TestGetBaseResult_WhenBaseScenarioExists_ExpectsBaseScenarioReturned', () => {
    const results: ScenarioResult[] = [
      createScenarioResult('bear'),
      createScenarioResult('base', { differencePLN: -700 }),
      createScenarioResult('bull'),
    ];

    expect(getBaseResult(results)?.key).toBe('base');
    expect(getBaseResult(results)?.differencePLN).toBe(-700);
  });

  it('TestGetDecisionSummary_WhenBenchmarkWinsBaseScenario_ExpectsSellRecommendationAndScenarioCounts', () => {
    const results: ScenarioResult[] = [
      createScenarioResult('bear', { stockBeatsBenchmark: false, differencePLN: -900, differencePercent: -8.3 }),
      createScenarioResult('base', { stockBeatsBenchmark: false, differencePLN: -700, differencePercent: -6.2 }),
      createScenarioResult('bull', { stockBeatsBenchmark: true, differencePLN: 250, differencePercent: 2.1 }),
    ];

    const summary = getDecisionSummary(results);

    expect(summary).not.toBeNull();
    expect(summary?.winnerLabel).toBe('ETF');
    expect(summary?.winnerVerb).toBe('wygrywa');
    expect(summary?.actionTitle).toContain('wyższy wynik netto');
    expect(summary?.supportingScenarioCount).toBe(2);
    expect(summary?.conflictingScenarioCount).toBe(1);
  });

  it('TestGetDecisionSummary_WhenSavingsWins_ExpectsNaturalSavingsRecommendation', () => {
    const results: ScenarioResult[] = [
      createScenarioResult('bear', { benchmarkLabel: 'Konto', stockBeatsBenchmark: false }),
      createScenarioResult('base', { benchmarkLabel: 'Konto', stockBeatsBenchmark: false }),
      createScenarioResult('bull', { benchmarkLabel: 'Konto', stockBeatsBenchmark: true }),
    ];

    const summary = getDecisionSummary(results);

    expect(summary?.actionTitle).toBe('Scenariusz bazowy: konto oszczędnościowe daje wyższy wynik netto');
    expect(summary?.actionSubtitle).toContain('konto oszczędnościowe');
  });

  it('TestFormatScenarioList_WhenTwoScenarioLabels_ExpectsPolishConjunction', () => {
    expect(formatScenarioList(['Base', 'Bull'])).toBe('Base i Bull');
  });

  it('TestGetScenarioConsistencyText_WhenOneScenarioDiffers_ExpectsSupportingAndConflictingScenarioNames', () => {
    expect(getScenarioConsistencyText(['Base', 'Bull'], ['Bear'])).toBe(
      'Zgodny kierunek: scenariusze Base i Bull. Odmienny wynik: scenariusz Bear.',
    );
  });
});
