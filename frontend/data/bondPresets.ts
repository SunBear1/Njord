/**
 * Polish Treasury Bond (obligacje skarbowe) — metadata constants.
 *
 * Bond data (rates, penalties, margins) is loaded at runtime from
 * the CSV source of truth via GET /api/bonds (see functions/api/bonds.ts).
 * The CSV lives at: data/polish_treasury_bonds.csv
 *
 * Update BOND_PRESETS_LAST_UPDATED whenever the CSV is refreshed.
 */

/**
 * Last update date for display in UI disclaimer.
 * Update this when bond rates are refreshed from obligacjeskarbowe.pl.
 */
export const BOND_PRESETS_LAST_UPDATED = '2026-04-11';
export const BOND_PRESETS_SOURCE_URL = 'https://www.obligacjeskarbowe.pl/oferta-obligacji/';

