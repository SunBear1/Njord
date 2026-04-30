import { Check } from 'lucide-react';

const STEP_LABELS = ['Twoje dane', 'Brokerzy', 'Alokacja', 'Podsumowanie'] as const;

type StepNumber = 1 | 2 | 3 | 4;

interface WizardStepperProps {
  currentStep: StepNumber;
  onStepClick: (step: StepNumber) => void;
}

export default function WizardStepper({ currentStep, onStepClick }: WizardStepperProps) {
  return (
    <nav aria-label="Postęp kreatora portfela" className="w-full px-2 sm:px-4">
      <ol className="flex items-center w-full">
        {([1, 2, 3, 4] as const).map((step, i) => {
          const isCompleted = step < currentStep;
          const isActive = step === currentStep;

          return (
            <li
              key={step}
              className={`flex items-center ${i < 3 ? 'flex-1' : ''}`}
            >
              {/* Step circle */}
              {isCompleted ? (
                <button
                  type="button"
                  onClick={() => onStepClick(step)}
                  aria-label={`Przejdź do kroku ${step}: ${STEP_LABELS[i]}`}
                  className="relative flex items-center justify-center
                    w-8 h-8 md:w-10 md:h-10 shrink-0
                    rounded-full bg-accent-success text-on-dark
                    cursor-pointer transition-colors duration-200
                    hover:bg-green-600 dark:hover:bg-green-500
                    focus-visible:outline-none focus-visible:ring-2
                    focus-visible:ring-accent-success focus-visible:ring-offset-2
                    dark:focus-visible:ring-offset-bg-primary"
                >
                  <Check className="w-4 h-4 md:w-5 md:h-5" strokeWidth={3} aria-hidden="true" />
                </button>
              ) : (
                <span
                  role="listitem"
                  aria-current={isActive ? 'step' : undefined}
                  aria-disabled={!isActive}
                  className={`relative flex items-center justify-center
                    w-8 h-8 md:w-10 md:h-10 shrink-0
                    rounded-full text-sm md:text-base font-semibold
                    transition-colors duration-200
                    ${
                      isActive
                        ? 'bg-accent-info text-on-dark ring-2 ring-accent dark:ring-accent/50'
                        : 'bg-surface-muted dark:bg-surface-dark-alt text-text-muted'
                    }`}
                >
                  {step}
                </span>
              )}

              {/* Connector line */}
              {i < 3 ? (
                <div
                  aria-hidden="true"
                  className={`flex-1 h-0.5 mx-1.5 sm:mx-2 md:mx-3 rounded-full transition-colors duration-200 ${
                    step < currentStep
                      ? 'bg-accent-success'
                      : 'bg-surface-muted dark:bg-surface-dark-alt'
                  }`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Labels */}
      <div className="flex w-full mt-2">
        {STEP_LABELS.map((label, i) => {
          const step = (i + 1) as StepNumber;
          const isActive = step === currentStep;
          const isCompleted = step < currentStep;

          return (
            <span
              key={label}
              className={`flex-1 text-center text-xs md:text-sm truncate
                hidden sm:block
                ${isActive ? 'font-semibold text-accent-info' : ''}
                ${isCompleted ? 'text-accent-success' : ''}
                ${!isActive && !isCompleted ? 'text-text-muted' : ''}`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </nav>
  );
}
