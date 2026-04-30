# Validation Loops & Quality Gates

## Mandatory Validation Sequence

### After ANY code change
```bash
npx tsc --noEmit          # Type-check (fastest — run first)
npm run lint              # ESLint zero-error policy
npm test                  # All 446+ tests must pass
npm run build             # Production build must succeed
```

If ANY step fails: fix before proceeding. NEVER skip a failing step.

### After modifying `src/utils/` or `src/hooks/`
1. Run full validation sequence above
2. Verify no regressions in related calculation tests
3. If financial logic changed: manually verify one scenario against known-good values
4. Check that pure functions remain pure (no imports of `fetch`, `localStorage`, DOM APIs)

### After modifying `src/components/`
1. Run full validation sequence
2. `npm run dev` → visually inspect at 375px width (Chrome DevTools → iPhone SE)
3. Visually inspect at 1280px width
4. Verify dark mode still renders correctly
5. Keyboard-navigate through the modified component (Tab, Enter, Escape)

### After modifying `functions/api/`
1. Run full validation sequence
2. `npm run dev:full` → test the endpoint with curl/browser
3. Verify error responses return proper HTTP status codes and Polish error messages
4. Confirm API key is NOT in response body or client-accessible headers

### After modifying infrastructure (`infrastructure/`)
1. `terraform validate`
2. `terraform plan` — review changes, no unexpected destroys
3. Never `terraform apply` without explicit human approval

## Pre-Commit Checklist
Before committing ANY change:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` — zero errors, zero warnings
- [ ] `npm test` — all pass
- [ ] `npm run build` — succeeds
- [ ] Commit message follows Conventional Commits format
- [ ] No `console.log` left in code (except `console.error` for genuine errors)
- [ ] No `TODO` or `FIXME` without linked issue number
- [ ] No commented-out code blocks
- [ ] No `.dev.vars` or secrets in staged files

## Test Quality Standards
- Financial calculations: test with realistic data (actual stock prices, actual NBP rates).
- Edge cases to always cover:
  - Zero shares / zero cost basis (RSU mode)
  - Negative profit (loss scenarios)
  - Horizon = 1 month (minimum) and 144 months (maximum)
  - FX rate = 1.0 (no conversion needed)
  - All 8 bond types with their specific rate mechanics
  - Weekend/holiday dates for NBP rate lookups (must fall back to last business day)
- New utility function → new test file. No exceptions.
- Test file naming: `src/__tests__/[utilName].test.ts`

## Regression Prevention
- When fixing a bug: FIRST write a failing test that reproduces it, THEN fix the code.
- When refactoring: run tests before AND after. Diff test results.
- When adding features: write tests alongside implementation, not as afterthought.

## CI Pipeline Enforcement
`.github/workflows/build-and-test.action.yaml` runs on every push and PR:
1. lint
2. test
3. build

If CI fails, the PR cannot merge. Do not circumvent with force-push or skip flags.

## Manual Verification Points
Some things can't be automated — verify these manually:
- Chart readability (labels not overlapping, legend visible)
- Polish text correctness (no typos, proper declension)
- Number formatting (thousands separators, decimal places appropriate for context)
- Mobile layout not broken (no horizontal scroll, no cut-off text)
- Loading states appear and disappear correctly
- Error states show meaningful Polish messages
