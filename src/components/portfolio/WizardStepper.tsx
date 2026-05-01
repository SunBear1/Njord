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
      <ol className="flex items-start w-full">
        {([1, 2, 3, 4] as const).map((step, i) => {
          const isCompleted = step < currentStep;
          const isActive = step === currentStep;

          return (
            <li
              key={step}
              className={`flex flex-col items-center ${i < 3 ? 'flex-1' : ''}`}
            >
              {/* Top row: circle + connector */}
              <div className="flex items-center w-full">
                {/* Step circle */}
                {isCompleted ? (
                  <button
                    type="button"
                    onClick={() => onStepClick(step)}
                    aria-label={`Przejdź do kroku ${step}: ${STEP_LABELS[i]}`}
                    className="relative flex items-center justify-center
                      w-8 h-8 md:w-10 md:h-10 shrink-0
                      rounded-full bg-success text-white dark:text-bg-primary
                      cursor-pointer transition-colors duration-200
                      hover:bg-success/90
                      focus-visible:outline-none focus-visible:ring-2
                      focus-visible:ring-success focus-visible:ring-offset-2
                      focus-visible:ring-offset-bg-primary"
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
                          ? 'bg-accent-interactive text-white ring-2 ring-accent-primary'
                          : 'bg-bg-hover text-text-muted'
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
                        ? 'bg-success'
                        : 'bg-bg-hover'
                    }`}
                  />
                ) : null}
              </div>

              {/* Label directly under circle */}
              <span
                className={`mt-1.5 text-[11px] md:text-xs text-center w-full max-w-[5rem] leading-tight
                  hidden sm:block
                  ${isActive ? 'font-semibold text-accent-primary' : ''}
                  ${isCompleted ? 'text-success' : ''}
                  ${!isActive && !isCompleted ? 'text-text-muted' : ''}`}
              >
                {STEP_LABELS[i]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
