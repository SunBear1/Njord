import { useState, useMemo, useCallback, useEffect } from 'react';
import type {
  WizardStep,
  WizardState,
  PersonalData,
  WrapperPortfolioConfig,
  PortfolioAllocation,
} from '../types/portfolio';
import {
  BROKERS,
  DEFAULT_PERSONAL_DATA,
  IKE_DEFAULT_LIMIT,
  getIkzeLimit,
  ETF_PRESETS,
} from '../types/portfolio';

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'njord_portfolio_wizard';
const SCHEMA_VERSION = 1;

interface PersistedEnvelope {
  _v: number;
  state: WizardState;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultAllocationsForBroker(brokerId: string): PortfolioAllocation[] {
  const broker = BROKERS.find((b) => b.id === brokerId);
  if (!broker) return [];

  if (broker.instruments.includes('bonds') && !broker.instruments.includes('etf')) {
    return [
      {
        instrumentId: 'edo',
        instrumentType: 'bonds',
        allocationPercent: 100,
        expectedReturnPercent: 6.2,
      },
    ];
  }

  const msci = ETF_PRESETS.find((e) => e.id === 'msci_world');
  return [
    {
      instrumentId: msci?.id ?? 'msci_world',
      instrumentType: 'etf',
      allocationPercent: 100,
      expectedReturnPercent: msci?.historicalReturnPercent ?? 9,
    },
  ];
}

function defaultRegularAllocations(): PortfolioAllocation[] {
  const msci = ETF_PRESETS.find((e) => e.id === 'msci_world');
  return [
    {
      instrumentId: msci?.id ?? 'msci_world',
      instrumentType: 'etf',
      allocationPercent: 50,
      expectedReturnPercent: msci?.historicalReturnPercent ?? 9,
    },
    {
      instrumentId: 'edo',
      instrumentType: 'bonds',
      allocationPercent: 50,
      expectedReturnPercent: 6.2,
    },
  ];
}

function createDefaultState(): WizardState {
  return {
    currentStep: 1,
    personalData: { ...DEFAULT_PERSONAL_DATA },
    ikeBrokerId: null,
    ikzeBrokerId: null,
    ikeEnabled: true,
    ikzeEnabled: true,
    wrapperConfigs: [
      { wrapper: 'ike', enabled: true, brokerId: null, allocations: [] },
      { wrapper: 'ikze', enabled: true, brokerId: null, allocations: [] },
      { wrapper: 'regular', enabled: true, brokerId: null, allocations: defaultRegularAllocations() },
    ],
    reinvestIkzeDeduction: true,
    savingsRatePercent: 5.0,
  };
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadState(): WizardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const envelope = JSON.parse(raw) as PersistedEnvelope;
    if (envelope._v !== SCHEMA_VERSION) return createDefaultState();
    return envelope.state;
  } catch {
    return createDefaultState();
  }
}

function saveState(state: WizardState): void {
  try {
    const envelope: PersistedEnvelope = { _v: SCHEMA_VERSION, state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    /* storage unavailable — silent fallback */
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateStep1(pd: PersonalData): boolean {
  return pd.totalMonthlyPLN >= 100 && pd.horizonYears >= 1 && pd.horizonYears <= 50;
}

function validateStep2(state: WizardState): boolean {
  if (state.ikeEnabled && !state.ikeBrokerId) return false;
  if (state.ikzeEnabled && !state.ikzeBrokerId) return false;
  if (state.ikzeEnabled && state.ikzeBrokerId) {
    const broker = BROKERS.find((b) => b.id === state.ikzeBrokerId);
    if (broker && !broker.ikze) return false;
  }
  return true;
}

function validateAllocations(allocations: PortfolioAllocation[]): boolean {
  if (allocations.length === 0) return false;
  const sum = allocations.reduce((s, a) => s + a.allocationPercent, 0);
  return Math.abs(sum - 100) < 0.5;
}

function validateStep3(state: WizardState): boolean {
  for (const cfg of state.wrapperConfigs) {
    if (!cfg.enabled) continue;
    if (!validateAllocations(cfg.allocations)) return false;
  }
  return true;
}

function validateCurrentStep(state: WizardState): boolean {
  switch (state.currentStep) {
    case 1:
      return validateStep1(state.personalData);
    case 2:
      return validateStep2(state);
    case 3:
      return validateStep3(state);
    case 4:
      return true;
    default:
      return false;
  }
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseWizardStateReturn {
  state: WizardState;

  // Navigation
  currentStep: WizardStep;
  canAdvance: boolean;
  goNext: () => void;
  goBack: () => void;
  goToStep: (step: WizardStep) => void;

  // Step 1 setters
  updatePersonalData: (updates: Partial<PersonalData>) => void;

  // Step 2 setters
  setIkeBroker: (brokerId: string | null) => void;
  setIkzeBroker: (brokerId: string | null) => void;
  setIkeEnabled: (enabled: boolean) => void;
  setIkzeEnabled: (enabled: boolean) => void;

  // Step 3 setters
  updateWrapperConfig: (
    wrapperIndex: 0 | 1 | 2,
    config: Partial<WrapperPortfolioConfig>,
  ) => void;
  setReinvestIkzeDeduction: (reinvest: boolean) => void;

  // Derived values
  annualBudget: number;
  ikeAnnualLimit: number;
  ikzeAnnualLimit: number;
  ikeMonthlyAllocation: number;
  ikzeMonthlyAllocation: number;
  surplusMonthly: number;
  ikzePitDeductionAnnual: number;

  // Reset
  resetWizard: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWizardState(): UseWizardStateReturn {
  const [state, setState] = useState<WizardState>(loadState);

  // Persist on change (debounced to avoid writes on every slider tick)
  useEffect(() => {
    const timer = setTimeout(() => saveState(state), 300);
    return () => clearTimeout(timer);
  }, [state]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const canAdvance = useMemo(() => validateCurrentStep(state), [state]);

  const goNext = useCallback(() => {
    setState((prev) => {
      if (!validateCurrentStep(prev) || prev.currentStep >= 4) return prev;
      return { ...prev, currentStep: (prev.currentStep + 1) as WizardStep };
    });
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep <= 1) return prev;
      return { ...prev, currentStep: (prev.currentStep - 1) as WizardStep };
    });
  }, []);

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => {
      if (step > prev.currentStep) return prev;
      return { ...prev, currentStep: step };
    });
  }, []);

  // ── Step 1 setters ────────────────────────────────────────────────────────

  const updatePersonalData = useCallback((updates: Partial<PersonalData>) => {
    setState((prev) => ({
      ...prev,
      personalData: { ...prev.personalData, ...updates },
    }));
  }, []);

  // ── Step 2 setters ────────────────────────────────────────────────────────

  const setIkeBroker = useCallback((brokerId: string | null) => {
    setState((prev) => {
      const allocations = brokerId ? defaultAllocationsForBroker(brokerId) : [];
      const newConfigs = [...prev.wrapperConfigs] as WizardState['wrapperConfigs'];
      newConfigs[0] = { ...newConfigs[0], brokerId, allocations };
      return { ...prev, ikeBrokerId: brokerId, wrapperConfigs: newConfigs };
    });
  }, []);

  const setIkzeBroker = useCallback((brokerId: string | null) => {
    setState((prev) => {
      const allocations = brokerId ? defaultAllocationsForBroker(brokerId) : [];
      const newConfigs = [...prev.wrapperConfigs] as WizardState['wrapperConfigs'];
      newConfigs[1] = { ...newConfigs[1], brokerId, allocations };
      return { ...prev, ikzeBrokerId: brokerId, wrapperConfigs: newConfigs };
    });
  }, []);

  const setIkeEnabled = useCallback((enabled: boolean) => {
    setState((prev) => {
      const newConfigs = [...prev.wrapperConfigs] as WizardState['wrapperConfigs'];
      newConfigs[0] = { ...newConfigs[0], enabled };
      return { ...prev, ikeEnabled: enabled, wrapperConfigs: newConfigs };
    });
  }, []);

  const setIkzeEnabled = useCallback((enabled: boolean) => {
    setState((prev) => {
      const newConfigs = [...prev.wrapperConfigs] as WizardState['wrapperConfigs'];
      newConfigs[1] = { ...newConfigs[1], enabled };
      return { ...prev, ikzeEnabled: enabled, wrapperConfigs: newConfigs };
    });
  }, []);

  // ── Step 3 setters ────────────────────────────────────────────────────────

  const updateWrapperConfig = useCallback(
    (wrapperIndex: 0 | 1 | 2, config: Partial<WrapperPortfolioConfig>) => {
      setState((prev) => {
        const newConfigs = [...prev.wrapperConfigs] as WizardState['wrapperConfigs'];
        newConfigs[wrapperIndex] = { ...newConfigs[wrapperIndex], ...config };
        return { ...prev, wrapperConfigs: newConfigs };
      });
    },
    [],
  );

  const setReinvestIkzeDeduction = useCallback((reinvest: boolean) => {
    setState((prev) => ({ ...prev, reinvestIkzeDeduction: reinvest }));
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────

  const annualBudget = useMemo(
    () => state.personalData.totalMonthlyPLN * 12,
    [state.personalData.totalMonthlyPLN],
  );

  const ikeAnnualLimit = useMemo(
    () => (state.ikeEnabled ? IKE_DEFAULT_LIMIT : 0),
    [state.ikeEnabled],
  );

  const ikzeAnnualLimit = useMemo(
    () => (state.ikzeEnabled ? getIkzeLimit(state.personalData.isSelfEmployed) : 0),
    [state.ikzeEnabled, state.personalData.isSelfEmployed],
  );

  const ikeMonthlyAllocation = useMemo(
    () =>
      state.ikeEnabled
        ? Math.min(state.personalData.totalMonthlyPLN, ikeAnnualLimit / 12)
        : 0,
    [state.ikeEnabled, state.personalData.totalMonthlyPLN, ikeAnnualLimit],
  );

  const ikzeMonthlyAllocation = useMemo(
    () =>
      state.ikzeEnabled
        ? Math.min(
            state.personalData.totalMonthlyPLN - ikeMonthlyAllocation,
            ikzeAnnualLimit / 12,
          )
        : 0,
    [
      state.ikzeEnabled,
      state.personalData.totalMonthlyPLN,
      ikeMonthlyAllocation,
      ikzeAnnualLimit,
    ],
  );

  const surplusMonthly = useMemo(
    () => state.personalData.totalMonthlyPLN - ikeMonthlyAllocation - ikzeMonthlyAllocation,
    [state.personalData.totalMonthlyPLN, ikeMonthlyAllocation, ikzeMonthlyAllocation],
  );

  const ikzePitDeductionAnnual = useMemo(
    () => ikzeMonthlyAllocation * 12 * (state.personalData.pitBracket / 100),
    [ikzeMonthlyAllocation, state.personalData.pitBracket],
  );

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetWizard = useCallback(() => {
    const fresh = createDefaultState();
    setState(fresh);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    state,
    currentStep: state.currentStep,
    canAdvance,
    goNext,
    goBack,
    goToStep,
    updatePersonalData,
    setIkeBroker,
    setIkzeBroker,
    setIkeEnabled,
    setIkzeEnabled,
    updateWrapperConfig,
    setReinvestIkzeDeduction,
    annualBudget,
    ikeAnnualLimit,
    ikzeAnnualLimit,
    ikeMonthlyAllocation,
    ikzeMonthlyAllocation,
    surplusMonthly,
    ikzePitDeductionAnnual,
    resetWizard,
  };
}
