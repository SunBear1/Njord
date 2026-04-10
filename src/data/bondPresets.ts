/**
 * Polish Treasury Bond (obligacje skarbowe) presets.
 *
 * Source: https://www.obligacjeskarbowe.pl/oferta-obligacji/
 * Rates and penalties verified against official offering documents.
 * Last updated: 2025-07-17
 *
 * Early redemption penalties follow real rules:
 * - OTS: no early redemption (3-month maturity, too short)
 * - ROR: 0.50 PLN per unit (0.50% of 100 PLN nominal)
 * - DOR: 0.70 PLN per unit (0.70%)
 * - TOS: no early redemption allowed (locked for 3 years)
 * - COI: 2.00 PLN per unit (2.00%)
 * - EDO: 2.00 PLN per unit (2.00%) — same flat rate regardless of year
 * - ROS: 0.70 PLN per unit (0.70%)
 * - ROD: 2.00 PLN per unit (2.00%)
 */

import type { BondPreset } from '../types/scenario';

export const BOND_PRESETS: BondPreset[] = [
  {
    id: 'OTS',
    name: 'OTS (3-mies.)',
    maturityMonths: 3,
    rateType: 'fixed',
    firstYearRate: 1.50,
    margin: 0,
    earlyRedemptionPenalty: 0,
    earlyRedemptionAllowed: false,
    couponFrequency: 0,
    description: 'Stałoprocentowe, 3 miesiące',
  },
  {
    id: 'ROR',
    name: 'ROR (roczne)',
    maturityMonths: 12,
    rateType: 'reference',
    firstYearRate: 5.50,
    margin: 0,
    earlyRedemptionPenalty: 0.50,
    earlyRedemptionAllowed: true,
    couponFrequency: 12,
    description: 'Zmiennoprocentowe, stopa ref. NBP',
  },
  {
    id: 'DOR',
    name: 'DOR (2-letnie)',
    maturityMonths: 24,
    rateType: 'reference',
    firstYearRate: 5.60,
    margin: 0.25,
    earlyRedemptionPenalty: 0.70,
    earlyRedemptionAllowed: true,
    couponFrequency: 12,
    description: 'Zmiennoprocentowe, stopa ref. NBP + 0,25%',
  },
  {
    id: 'TOS',
    name: 'TOS (3-letnie)',
    maturityMonths: 36,
    rateType: 'fixed',
    firstYearRate: 5.70,
    margin: 0,
    earlyRedemptionPenalty: 0,
    earlyRedemptionAllowed: false,
    couponFrequency: 0,
    description: 'Stałoprocentowe, 3 lata — brak wcześniejszego wykupu',
  },
  {
    id: 'COI',
    name: 'COI (4-letnie)',
    maturityMonths: 48,
    rateType: 'inflation',
    firstYearRate: 6.00,
    margin: 1.50,
    earlyRedemptionPenalty: 2.00,
    earlyRedemptionAllowed: true,
    couponFrequency: 1,
    description: 'Inflacja + 1,50% marży',
  },
  {
    id: 'EDO',
    name: 'EDO (10-letnie)',
    maturityMonths: 120,
    rateType: 'inflation',
    firstYearRate: 6.20,
    margin: 2.00,
    earlyRedemptionPenalty: 2.00,
    earlyRedemptionAllowed: true,
    couponFrequency: 0,
    description: 'Inflacja + 2,00% marży',
  },
  {
    id: 'ROS',
    name: 'ROS (6-letnie)',
    maturityMonths: 72,
    rateType: 'inflation',
    firstYearRate: 6.05,
    margin: 2.00,
    earlyRedemptionPenalty: 0.70,
    earlyRedemptionAllowed: true,
    couponFrequency: 0,
    description: 'Rodzinne, inflacja + 2,00%',
    isFamily: true,
  },
  {
    id: 'ROD',
    name: 'ROD (12-letnie)',
    maturityMonths: 144,
    rateType: 'inflation',
    firstYearRate: 6.45,
    margin: 2.50,
    earlyRedemptionPenalty: 2.00,
    earlyRedemptionAllowed: true,
    couponFrequency: 0,
    description: 'Rodzinne, inflacja + 2,50%',
    isFamily: true,
  },
];

/**
 * Last update date for display in UI disclaimer.
 * Update this when bond rates are refreshed from obligacjeskarbowe.pl.
 */
export const BOND_PRESETS_LAST_UPDATED = '2025-07-17';
export const BOND_PRESETS_SOURCE_URL = 'https://www.obligacjeskarbowe.pl/oferta-obligacji/';
