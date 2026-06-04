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
  supportingScenarioLabels: string[];
  conflictingScenarioLabels: string[];
  winnerDiffPLN: number;
  winnerDiffPct: number;
}

const SCENARIO_LABELS: Record<ScenarioResult['key'], string> = {
  bear: 'Bear',
  base: 'Base',
  bull: 'Bull',
};

export function getBaseResult(results: ScenarioResult[]): ScenarioResult | null {
  return results.find((result) => result.key === 'base') ?? results[1] ?? results[0] ?? null;
}

export function getWinnerVerb(label: string): 'wygrywa' | 'wygrywają' {
  return PLURAL_WINNERS.has(label) ? 'wygrywają' : 'wygrywa';
}

export function formatScenarioList(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} i ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} i ${labels[labels.length - 1]}`;
}

export function getScenarioConsistencyText(
  supportingScenarioLabels: string[],
  conflictingScenarioLabels: string[],
): string {
  if (conflictingScenarioLabels.length === 0) {
    return `Ten sam kierunek pokazują scenariusze ${formatScenarioList(supportingScenarioLabels)}.`;
  }

  const supportPrefix = supportingScenarioLabels.length === 1 ? 'Zgodny kierunek: scenariusz' : 'Zgodny kierunek: scenariusze';
  const conflictPrefix = conflictingScenarioLabels.length === 1 ? 'Odmienny wynik: scenariusz' : 'Odmienny wynik: scenariusze';

  return `${supportPrefix} ${formatScenarioList(supportingScenarioLabels)}. ${conflictPrefix} ${formatScenarioList(conflictingScenarioLabels)}.`;
}

function getReinvestmentTarget(label: string): string {
  if (label === 'Konto') return 'konto oszczędnościowe';
  if (label === 'Obligacje') return 'obligacje skarbowe';
  if (label === 'ETF') return 'ETF-u';
  return label.toLowerCase();
}

export function getDecisionSummary(results: ScenarioResult[]): DecisionSummary | null {
  const baseResult = getBaseResult(results);
  if (!baseResult) return null;

  const winnerLabel = baseResult.stockBeatsBenchmark ? 'Akcje' : baseResult.benchmarkLabel;
  const winnerVerb = getWinnerVerb(winnerLabel);
  const supportingResults = results.filter(
    (result) => result.stockBeatsBenchmark === baseResult.stockBeatsBenchmark,
  );
  const conflictingResults = results.filter(
    (result) => result.stockBeatsBenchmark !== baseResult.stockBeatsBenchmark,
  );
  const supportingScenarioLabels = supportingResults.map((result) => SCENARIO_LABELS[result.key]);
  const conflictingScenarioLabels = conflictingResults.map((result) => SCENARIO_LABELS[result.key]);
  const supportingScenarioCount = supportingResults.length;
  const conflictingScenarioCount = results.length - supportingScenarioCount;

  return {
    baseResult,
    winnerLabel,
    winnerVerb,
    actionTitle: baseResult.stockBeatsBenchmark
      ? 'Scenariusz bazowy: akcje dają wyższy wynik netto'
      : `Scenariusz bazowy: ${getReinvestmentTarget(baseResult.benchmarkLabel)} daje wyższy wynik netto`,
    actionSubtitle: baseResult.stockBeatsBenchmark
      ? 'Przy tych założeniach, utrzymanie pozycji generuje wyższy szacowany wynik netto po podatku i FX.'
      : `Przy tych założeniach, ${getReinvestmentTarget(baseResult.benchmarkLabel)} generuje wyższy szacowany wynik netto po podatku.`,
    supportingScenarioCount,
    conflictingScenarioCount,
    supportingScenarioLabels,
    conflictingScenarioLabels,
    winnerDiffPLN: Math.abs(baseResult.differencePLN),
    winnerDiffPct: Math.abs(baseResult.differencePercent),
  };
}
