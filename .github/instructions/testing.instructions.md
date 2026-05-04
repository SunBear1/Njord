---
description: Test patterns, financial test requirements, and Playwright guidelines. Apply when writing or modifying tests.
applyTo: "src/__tests__/**/*.ts"
---

# Testing

## Test Naming Convention

Use descriptive names: `TestXxx_WhenCondition_ExpectsBehavior`

```typescript
describe('calcBelkaTax', () => {
  it('TestCalcBelkaTax_WhenZeroProfit_ExpectsZeroTax', () => { ... });
  it('TestCalcBelkaTax_WhenNegativeProfit_ExpectsZeroTax', () => { ... });
  it('TestCalcBelkaTax_WhenPositiveProfit_Expects19Percent', () => { ... });
});
```

## Financial Test Requirements

**Always test with realistic data (actual stock prices, actual NBP rates).**

Cover these edge cases:
- Zero shares / zero cost basis (RSU mode)
- Negative profit (loss scenarios — tax should be zero)
- Horizon = 1 month (minimum) and 144 months (maximum)
- FX rate = 1.0 (no currency conversion)
- All 8 bond types with their specific rate mechanics
- Weekend/holiday dates for NBP rate lookups (must fall back to last business day)
- Long-term monotonicity (profit grows monotonically with time for positive drift)
- Small positive gain (<1%)
- Large gain (>100%)

**Regression prevention:**
1. When fixing a bug: write a failing test FIRST, then fix the code
2. When refactoring: run tests before AND after. Diff test results
3. When adding features: write tests alongside implementation

## Playwright E2E Tests

Start dev server, then run:
```bash
npm run dev &
npm run test:e2e
```

Template:
```typescript
import { test, expect } from '@playwright/test';

test('ComparisonPage loads and calculates', async ({ page }) => {
  await page.goto('http://localhost:5173/comparison');
  await page.waitForLoadState('networkidle');
  
  // Reconnaissance: inspect rendered state
  const button = page.locator('button:has-text("Oblicz")');
  
  // Action: click and verify
  await button.click();
  await expect(page.locator('text=Wynik')).toBeVisible();
});
```

**Critical:** Always `waitForLoadState('networkidle')` before inspection on dynamic apps.

## New Utility → New Test File

Every new utility function in `src/utils/` gets its own test file: `src/__tests__/[utilName].test.ts`. No exceptions.

## CI Pipeline

`.github/workflows/build-and-test.action.yaml` runs: lint → test → build

If CI fails, the PR cannot merge. Do not bypass with force-push or skip flags.
