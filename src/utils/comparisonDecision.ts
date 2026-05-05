import type { ScenarioResult } from '../types/scenario';

const PLURAL_WINNERS = new Set(['Akcje', 'Obligacje']);

export interface DecisionSummary {
  baseResult: ScenarioResult;
  winnerLabel: string;
  winnerVerb: 'wygrywa' | 'wygrywają';
  actionTitle: string;
  actionSubtitle: string;
  supportingScenarioCount: number;
  conflictingScenarioCount: number;
  winnerDiffPLN: number;
  winnerDiffPct: number;
}

export function getBaseResult(results: ScenarioResult[]): ScenarioResult | null {
  return results.find((result) => result.key === 'base') ?? results[1] ?? results[0] ?? null;
}

export function getWinnerVerb(label: string): 'wygrywa' | 'wygrywają' {
  return PLURAL_WINNERS.has(label) ? 'wygrywają' : 'wygrywa';
}

export function getDecisionSummary(results: ScenarioResult[]): DecisionSummary | null {
  const baseResult = getBaseResult(results);
  if (!baseResult) return null;

  const winnerLabel = baseResult.stockBeatsBenchmark ? 'Akcje' : baseResult.benchmarkLabel;
  const winnerVerb = getWinnerVerb(winnerLabel);
  const supportingScenarioCount = results.filter(
    (result) => result.stockBeatsBenchmark === baseResult.stockBeatsBenchmark,
  ).length;
  const conflictingScenarioCount = results.length - supportingScenarioCount;

  return {
    baseResult,
    winnerLabel,
    winnerVerb,
    actionTitle: baseResult.stockBeatsBenchmark
      ? 'Na ten moment lepiej trzymać akcje'
      : `Na ten moment lepiej sprzedać i przenieść środki do ${baseResult.benchmarkLabel}`,
    actionSubtitle: baseResult.stockBeatsBenchmark
      ? 'Scenariusz bazowy pokazuje, że trzymanie pozycji daje wyższy wynik netto niż natychmiastowa rotacja kapitału.'
      : `Scenariusz bazowy pokazuje, że ${baseResult.benchmarkLabel.toLowerCase()} daje wyższy wynik netto niż dalsze trzymanie akcji.`,
    supportingScenarioCount,
    conflictingScenarioCount,
    winnerDiffPLN: Math.abs(baseResult.differencePLN),
    winnerDiffPct: Math.abs(baseResult.differencePercent),
  };
}
