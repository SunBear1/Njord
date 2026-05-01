import { ArrowLeft, ArrowRight, BarChart3 } from 'lucide-react';

interface WizardNavigationProps {
  currentStep: 1 | 2 | 3 | 4;
  canAdvance: boolean;
  onNext: () => void;
  onBack: () => void;
}

const TOTAL_STEPS = 4;

export default function WizardNavigation({
  currentStep,
  canAdvance,
  onNext,
  onBack,
}: WizardNavigationProps) {
  const showBack = currentStep > 1;
  const showNext = currentStep < TOTAL_STEPS;
  const isLastBeforeSummary = currentStep === 3;

  const nextLabel = isLastBeforeSummary ? 'Zobacz wyniki' : 'Dalej';
  const NextIcon = isLastBeforeSummary ? BarChart3 : ArrowRight;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-4">
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Poprzedni krok"
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-card"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Wstecz
        </button>
      ) : (
        <span />
      )}

      <span className="text-sm text-text-muted order-last sm:order-none w-full sm:w-auto text-center">
        Krok {currentStep} z {TOTAL_STEPS}
      </span>

      {showNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!canAdvance}
          aria-label={nextLabel}
          aria-disabled={!canAdvance}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${
            canAdvance
              ? 'text-text-on-accent bg-accent-interactive hover:bg-accent-interactive/80'
              : 'text-text-muted bg-bg-hover cursor-not-allowed'
          }`}
        >
          {nextLabel}
          <NextIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
