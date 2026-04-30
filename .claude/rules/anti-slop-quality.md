# Anti-Slop & Code Quality

## What is "AI Slop"?
Generated code that looks correct but is bloated, generic, over-engineered, or stylistically inconsistent with the codebase. This file defines what to REJECT.

## Code Smell Detection

### Structural Slop
- ❌ Adding abstractions before they're needed (premature factories, strategy patterns, DI containers)
- ❌ Creating `utils/helpers.ts` or `common/index.ts` catch-all files
- ❌ Wrapping simple functions in classes for no reason
- ❌ Adding builder patterns for objects with <5 fields
- ❌ Creating interfaces that have only one implementation
- ❌ Generating excessive JSDoc for self-explanatory functions
- ❌ Adding `try/catch` around code that can't throw
- ❌ Wrapping primitive values in objects ("value objects" without behavior)

### Comment Slop
- ❌ Comments that restate the code: `// increment counter` above `counter++`
- ❌ Tombstone comments: `// TODO: implement later` without issue reference
- ❌ Banner comments: `// ========= SECTION NAME =========`
- ❌ Commented-out code blocks (delete it — git remembers)
- ❌ JSDoc on every function regardless of complexity
- ✅ Comments that explain WHY (business rule, tax law, edge case)
- ✅ Comments referencing Polish tax law articles or NBP documentation

### Naming Slop
- ❌ Generic names: `data`, `info`, `item`, `result`, `value`, `temp`, `obj`
- ❌ Hungarian notation: `strName`, `numCount`, `boolIsActive`
- ❌ Redundant type info: `userList: User[]` (just call it `users`)
- ❌ Abbreviations that save <3 characters: `btn` for `button`, `msg` for `message`
- ✅ Domain-specific names: `belkaTax`, `nbpRate`, `deltaStock`, `horizonMonths`
- ✅ Action verbs for functions: `calcBondReturn`, `fetchNbpRate`, `formatPLN`

### UI Slop (AI loves to generate these)
- ❌ Wrapper divs that serve no layout purpose (`<div><div><Component /></div></div>`)
- ❌ Inline handlers with complex logic: `onClick={() => { /* 10 lines */ }}`
- ❌ Ternary nesting beyond 1 level: `a ? b ? c : d : e`
- ❌ Fragment soup: excessive `<>...</>` when a semantic element would work
- ❌ `className` strings >100 characters without extraction
- ❌ Duplicated Tailwind class blocks across sibling elements (extract component)
- ❌ Hardcoded strings that should be constants or come from data

### Logic Slop
- ❌ `if (condition) { return true; } else { return false; }` → `return condition;`
- ❌ `if (arr.length > 0)` → `if (arr.length)` (but NOT for nullable arrays)
- ❌ Optional chaining chains >3 deep: `a?.b?.c?.d?.e` (restructure the data)
- ❌ Nullish coalescing cascades: `a ?? b ?? c ?? d` (unclear precedence)
- ❌ Type assertions (`as Type`) instead of proper type guards
- ❌ `Object.keys(obj).forEach` when `for...of Object.entries()` is clearer
- ❌ Spreading into new objects just to change one field when direct assignment works

## Quality Signals — GOOD Code

### Concise
```typescript
// ✅ Good: direct, no ceremony
const profit = sellValue - costBasis - commission;
const tax = Math.max(0, profit * BELKA_RATE);
```

### Self-documenting
```typescript
// ✅ Good: name explains the business rule
function getLastBusinessDayBefore(date: Date): Date { ... }
```

### Predictable structure
```typescript
// ✅ Good: consistent hook return shape
function useAssetData(ticker: string) {
  return { data, error, isLoading, refetch };
}
```

### Minimal props
```typescript
// ✅ Good: component takes only what it needs
interface VerdictBannerProps {
  scenarios: ScenarioResult[];
  benchmarkType: BenchmarkType;
}
```

## File Size Limits
- Components: <300 lines. If larger → split into sub-components.
- Utility files: <200 lines. If larger → split by domain.
- Hooks: <150 lines. If larger → extract helper functions to utils.
- Test files: no limit (thorough testing is never slop).

## Dependency Rules
- Before adding ANY npm package, answer:
  1. Can I write this in <50 lines of TypeScript? → Write it.
  2. Is it a polyfill for something already in Node 22 / modern browsers? → Don't add.
  3. Does it pull in >100KB to the bundle? → Find a lighter alternative.
  4. Is it maintained (updated in last 6 months, >1000 weekly downloads)? → Acceptable.
- Current allowed dependencies are in `package.json`. Additions require justification.

## Git Hygiene
- Commits: atomic (one logical change per commit).
- Commit messages: `type(scope): description` — English, imperative mood, <72 chars.
  - `feat(tax): add DKK currency support`
  - `fix(bonds): correct early redemption penalty order`
  - `refactor(utils): extract NBP rate fetching to dedicated module`
- NEVER: `fix: stuff`, `update`, `wip`, `asdf`, `temp commit`
- Branch names: `feat/description`, `fix/description`, `refactor/description`

## Review Checklist (Self-Review Before PR)
- [ ] No dead code or unused imports
- [ ] No `console.log` (only `console.error` for genuine errors)
- [ ] No magic numbers without named constants
- [ ] No duplicated logic (DRY — but don't abstract prematurely)
- [ ] Function does ONE thing
- [ ] Types are specific (no `any`, minimal `unknown`, no union of >4 types)
- [ ] Error paths handled (what if API fails? what if input is empty?)
- [ ] Polish text proofread (no typos, correct grammatical cases)
