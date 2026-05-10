import { describe, expect, it } from 'vitest';
import { deriveSavedAutofillState } from '../hooks/usePortfolioState';

describe('deriveSavedAutofillState', () => {
  it('TestDeriveSavedAutofillState_WhenPersistedValuesExist_ExpectsAutofillToStayBlockedUntilReset', () => {
    expect(deriveSavedAutofillState({
      currentFxRate: 4.21,
      inflationRate: 3.7,
      etfAnnualReturnPercent: 8.4,
    })).toEqual({
      fxRate: true,
      inflationRate: true,
      etfAnnualReturnPercent: true,
    });
  });

  it('TestDeriveSavedAutofillState_WhenOnlyDefaultsWerePersisted_ExpectsAutofillToRemainEnabled', () => {
    expect(deriveSavedAutofillState({
      currentFxRate: 0,
      inflationRate: 0,
      etfAnnualReturnPercent: 0,
    })).toEqual({
      fxRate: false,
      inflationRate: false,
      etfAnnualReturnPercent: false,
    });
  });

  it('TestDeriveSavedAutofillState_WhenNothingWasSaved_ExpectsNoAutofillBlocks', () => {
    expect(deriveSavedAutofillState(null)).toEqual({
      fxRate: false,
      inflationRate: false,
      etfAnnualReturnPercent: false,
    });
  });
});
