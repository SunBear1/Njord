/** Types and constants for the "Kreator portfela" (Portfolio Creator) wizard. */

// ─── Wizard Navigation ────────────────────────────────────────────────────────

/** Wizard step: 1=Personal data, 2=Broker selection, 3=Allocation, 4=Summary. */
export type WizardStep = 1 | 2 | 3 | 4;

// ─── Tax ──────────────────────────────────────────────────────────────────────

/** PIT tax bracket: 12% (first bracket), 19% (linear/self-employed), 32% (second bracket). */
export type PitBracket = 12 | 19 | 32;

export const TAX_RATES = {
  belka: 0.19,
  ikzeRyczalt: 0.10,
  ikeAfter60: 0.00,
  pitBrackets: [0.12, 0.32] as const,
  pitLinear: 0.19,
} as const;

// ─── Instruments ──────────────────────────────────────────────────────────────

export type PortfolioInstrumentType =
  | 'etf'
  | 'stocks_pl'
  | 'stocks_foreign'
  | 'bonds'
  | 'savings';

// ─── Broker ───────────────────────────────────────────────────────────────────

export interface Broker {
  id: string;
  name: string;
  ike: boolean;
  ikze: boolean;
  instruments: PortfolioInstrumentType[];
  commissionEtf: string;
  fxSpread: string;
  notes: string;
}

export const BROKERS: readonly Broker[] = [
  {
    id: 'xtb',
    name: 'XTB',
    ike: true,
    ikze: false,
    instruments: ['etf', 'stocks_pl', 'stocks_foreign'],
    commissionEtf: '0% do 100k EUR obrotu/mies.',
    fxSpread: '0.5%',
    notes: 'Brak IKZE. Najpopularniejszy wybór dla IKE z ETF-ami.',
  },
  {
    id: 'bossa',
    name: 'DM BOŚ (Bossa)',
    ike: true,
    ikze: true,
    instruments: ['etf', 'stocks_pl', 'stocks_foreign'],
    commissionEtf: '0.29% (min 29 PLN)',
    fxSpread: '~0.5%',
    notes: 'Wygodna integracja z kontem bankowym mBank.',
  },
  {
    id: 'santander',
    name: 'Santander BM',
    ike: true,
    ikze: true,
    instruments: ['etf', 'stocks_pl', 'stocks_foreign'],
    commissionEtf: '0.29% (min 19 PLN) GPW',
    fxSpread: '~0.6%',
    notes: 'Ograniczony dostęp do giełd zagranicznych.',
  },
  {
    id: 'bdm',
    name: 'BDM',
    ike: true,
    ikze: true,
    instruments: ['etf', 'stocks_pl', 'stocks_foreign'],
    commissionEtf: '0.29% (min 19 PLN) GPW',
    fxSpread: '~0.5%',
    notes: 'Mniejszy broker, ale pełna oferta IKE/IKZE.',
  },
  {
    id: 'pkobp',
    name: 'PKO BP (IKE-Obligacje)',
    ike: true,
    ikze: true,
    instruments: ['bonds'],
    commissionEtf: 'brak — obligacje kupowane bez prowizji',
    fxSpread: 'nie dotyczy',
    notes:
      'JEDYNY broker umożliwiający zakup obligacji detalicznych w IKE/IKZE. Nie można tu kupić ETF-ów ani akcji.',
  },
] as const;

// ─── ETF Presets ──────────────────────────────────────────────────────────────

export interface EtfPreset {
  id: string;
  name: string;
  type: string;
  currency: string;
  /** Midpoint of historical annual return range. */
  historicalReturnPercent: number;
  risk: 'low' | 'medium' | 'medium-high' | 'high';
}

export const ETF_PRESETS: readonly EtfPreset[] = [
  {
    id: 'msci_world',
    name: 'MSCI World (iShares SWDA / Vanguard VWCE)',
    type: 'Akcje globalne',
    currency: 'USD/EUR',
    historicalReturnPercent: 9,
    risk: 'medium',
  },
  {
    id: 'sp500',
    name: 'S&P 500 (iShares CSPX / Vanguard VUAA)',
    type: 'Akcje USA',
    currency: 'USD',
    historicalReturnPercent: 11,
    risk: 'medium',
  },
  {
    id: 'ftse_all',
    name: 'FTSE All-World (Vanguard VWCE)',
    type: 'Akcje globalne + EM',
    currency: 'USD',
    historicalReturnPercent: 8,
    risk: 'medium',
  },
  {
    id: 'wig20',
    name: 'WIG20 ETF (Beta ETF WIG20TR)',
    type: 'Akcje polskie',
    currency: 'PLN',
    historicalReturnPercent: 5.5,
    risk: 'medium-high',
  },
  {
    id: 'tbsp',
    name: 'ETF obligacyjny (Beta ETF TBSP)',
    type: 'Obligacje skarbowe PL',
    currency: 'PLN',
    historicalReturnPercent: 4,
    risk: 'low',
  },
] as const;

// ─── Portfolio Allocation ─────────────────────────────────────────────────────

export interface PortfolioAllocation {
  /** ETF preset id, bond preset id, or 'savings'. */
  instrumentId: string;
  instrumentType: PortfolioInstrumentType;
  /** 0–100; all allocations in a bucket must sum to 100. */
  allocationPercent: number;
  /** User-editable, pre-filled from preset. */
  expectedReturnPercent: number;
}

// ─── Wrapper Configuration ────────────────────────────────────────────────────

export interface WrapperPortfolioConfig {
  wrapper: 'ike' | 'ikze' | 'regular';
  enabled: boolean;
  /** Broker id; null for 'regular' wrapper. */
  brokerId: string | null;
  allocations: PortfolioAllocation[];
}

// ─── Wizard State ─────────────────────────────────────────────────────────────

export interface PersonalData {
  totalMonthlyPLN: number;
  horizonYears: number;
  pitBracket: PitBracket;
  isSelfEmployed: boolean;
  inflationRate: number;
  isBeneficiary800Plus: boolean;
}

export interface WizardState {
  currentStep: WizardStep;
  personalData: PersonalData;
  ikeBrokerId: string | null;
  ikzeBrokerId: string | null;
  ikeEnabled: boolean;
  ikzeEnabled: boolean;
  /** Tuple: [IKE, IKZE, Regular]. */
  wrapperConfigs: [WrapperPortfolioConfig, WrapperPortfolioConfig, WrapperPortfolioConfig];
  reinvestIkzeDeduction: boolean;
  /** For IKZE deduction reinvestment and savings instrument. */
  savingsRatePercent: number;
}

// ─── IKE / IKZE Contribution Limits ──────────────────────────────────────────

/** IKE annual contribution limit for 2025. */
export const IKE_LIMIT_2025 = 26_019;

/** IKZE annual contribution limit for employees (2025). */
export const IKZE_LIMIT_EMPLOYEE_2025 = 10_407.60;

/** IKZE annual contribution limit for self-employed (2025). */
export const IKZE_LIMIT_SELF_EMPLOYED_2025 = 15_611.40;

/** Current default IKE limit (2025). */
export const IKE_DEFAULT_LIMIT = IKE_LIMIT_2025;

/** Current default IKZE limit for employees (2025). */
export const IKZE_DEFAULT_LIMIT_EMPLOYEE = IKZE_LIMIT_EMPLOYEE_2025;

/** Current default IKZE limit for self-employed (2025). */
export const IKZE_DEFAULT_LIMIT_SELF_EMPLOYED = IKZE_LIMIT_SELF_EMPLOYED_2025;

/** Get IKZE limit based on employment status. */
export function getIkzeLimit(isSelfEmployed: boolean): number {
  return isSelfEmployed ? IKZE_LIMIT_SELF_EMPLOYED_2025 : IKZE_LIMIT_EMPLOYEE_2025;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_PERSONAL_DATA: PersonalData = {
  totalMonthlyPLN: 2000,
  horizonYears: 20,
  pitBracket: 12,
  isSelfEmployed: false,
  inflationRate: 3.5,
  isBeneficiary800Plus: false,
};
