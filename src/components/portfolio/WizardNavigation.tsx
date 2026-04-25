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
    <div className="flex items-center justify-between py-4">
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Poprzedni krok"
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Wstecz
        </button>
      ) : (
        <span />
      )}

      <span className="text-sm text-gray-400 dark:text-gray-500">
        Krok {currentStep} z {TOTAL_STEPS}
      </span>

      {showNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!canAdvance}
          aria-label={nextLabel}
          aria-disabled={!canAdvance}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white ${
            canAdvance
              ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
              : 'bg-blue-600 opacity-50 cursor-not-allowed dark:bg-blue-500'
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
