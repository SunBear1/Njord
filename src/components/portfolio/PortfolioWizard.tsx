import { useMemo } from 'react';
import { useWizardState } from '../../hooks/useWizardState';
import WizardStepper from './WizardStepper';
import WizardNavigation from './WizardNavigation';
import Step1PersonalData from './Step1PersonalData';
import Step2BrokerSelection from './Step2BrokerSelection';
import Step3Allocation from './Step3Allocation';
import { Step4Summary } from './Step4Summary';
import { calcPortfolioResult } from '../../utils/accumulationCalculator';
import { blendedInflationRate } from '../../utils/inflationProjection';
import type { PortfolioCalcInputs } from '../../utils/accumulationCalculator';
import type { BondPreset } from '../../types/scenario';

interface PortfolioWizardProps {
  bondPresets: BondPreset[];
  isDark?: boolean;
}

export function PortfolioWizard({ bondPresets, isDark }: PortfolioWizardProps) {
  const wizard = useWizardState();

  const portfolioResult = useMemo(() => {
    if (wizard.currentStep < 4) return null;

    const inputs: PortfolioCalcInputs = {
      totalMonthlyPLN: wizard.state.personalData.totalMonthlyPLN,
      horizonYears: wizard.state.personalData.horizonYears,
      pitBracket: wizard.state.personalData.pitBracket,
      // Use blended inflation rate (mean-reversion) instead of snapshot — prevents
      // overstatement of inflation-linked bond returns on long horizons.
      inflationRate: wizard.state.personalData.inflationRate > 0
        ? blendedInflationRate(wizard.state.personalData.inflationRate, wizard.state.personalData.horizonYears * 12)
        : 0,
      ikeAnnualLimit: wizard.ikeAnnualLimit,
      ikzeAnnualLimit: wizard.ikzeAnnualLimit,
      savingsRate: wizard.state.savingsRatePercent,
      reinvestIkzeDeduction: wizard.state.reinvestIkzeDeduction,
      wrapperConfigs: wizard.state.wrapperConfigs,
      bondPresets,
    };

    return calcPortfolioResult(inputs);
  }, [
    wizard.currentStep,
    wizard.state.personalData.totalMonthlyPLN,
    wizard.state.personalData.horizonYears,
    wizard.state.personalData.pitBracket,
    wizard.state.personalData.inflationRate,
    wizard.ikeAnnualLimit,
    wizard.ikzeAnnualLimit,
    wizard.state.savingsRatePercent,
    wizard.state.reinvestIkzeDeduction,
    wizard.state.wrapperConfigs,
    bondPresets,
  ]);

  return (
    <div className="space-y-6">
      {/* Header with reset button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
          Kreator portfela
        </h2>
        <button
          type="button"
          onClick={wizard.resetWizard}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent-error)] transition-colors"
        >
          Resetuj kreator
        </button>
      </div>

      {/* Stepper */}
      <WizardStepper
        currentStep={wizard.currentStep}
        onStepClick={wizard.goToStep}
      />

      {/* Step content */}
      {wizard.currentStep === 1 ? (
        <Step1PersonalData
          personalData={wizard.state.personalData}
          updatePersonalData={wizard.updatePersonalData}
          annualBudget={wizard.annualBudget}
          ikeAnnualLimit={wizard.ikeAnnualLimit}
          ikzeAnnualLimit={wizard.ikzeAnnualLimit}
        />
      ) : null}
      {wizard.currentStep === 2 ? (
        <Step2BrokerSelection
          ikeBrokerId={wizard.state.ikeBrokerId}
          ikzeBrokerId={wizard.state.ikzeBrokerId}
          ikeEnabled={wizard.state.ikeEnabled}
          ikzeEnabled={wizard.state.ikzeEnabled}
          setIkeBroker={wizard.setIkeBroker}
          setIkzeBroker={wizard.setIkzeBroker}
          setIkeEnabled={wizard.setIkeEnabled}
          setIkzeEnabled={wizard.setIkzeEnabled}
        />
      ) : null}
      {wizard.currentStep === 3 ? (
        <Step3Allocation
          state={wizard.state}
          updateWrapperConfig={wizard.updateWrapperConfig}
          setReinvestIkzeDeduction={wizard.setReinvestIkzeDeduction}
          ikeMonthlyAllocation={wizard.ikeMonthlyAllocation}
          ikzeMonthlyAllocation={wizard.ikzeMonthlyAllocation}
          surplusMonthly={wizard.surplusMonthly}
          ikzePitDeductionAnnual={wizard.ikzePitDeductionAnnual}
          bondPresets={bondPresets}
        />
      ) : null}
      {wizard.currentStep === 4 && portfolioResult ? (
        <Step4Summary
          result={portfolioResult}
          wizardState={wizard.state}
          goToStep={wizard.goToStep}
          isDark={isDark}
        />
      ) : null}

      {/* Navigation */}
      <WizardNavigation
        currentStep={wizard.currentStep}
        canAdvance={wizard.canAdvance}
        onNext={wizard.goNext}
        onBack={wizard.goBack}
      />
    </div>
  );
}
