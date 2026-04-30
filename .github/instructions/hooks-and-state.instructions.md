---
description: >
  Architecture and safety rules for React hooks, page-level state management, and data providers.
  Apply when reading or modifying any hook, page component, Layout, or provider modules.
  Prevents race conditions, localStorage corruption, and state architecture violations.
globs:
  - src/hooks/**
  - src/pages/**
  - src/components/Layout.tsx
  - src/providers/**
---

# Hooks, State, and Providers

## 1. Page-Level State Ownership

**Each page component owns its own state.** `Layout.tsx` owns shared concerns (dark mode, auth, route persistence). No global store.

- No Zustand, Redux, Recoil, Context API stores, or any other global state
- Child components receive data and callbacks via explicitly typed props interfaces
- If a new feature needs state, add it to the relevant page component and thread it down via props

**Auto-apply pattern** (`userScenarios === null` guard in `ComparisonPage.tsx`):

```typescript
// scenarios is derived: user overrides take priority, then model suggestions, then defaults
const scenarios = userScenarios ?? suggestedScenarios ?? DEFAULT_SCENARIOS;

// When new model suggestions arrive and user hasn't manually edited, bump the
// ScenarioEditor key to remount it with fresh values.
useEffect(() => {
  if (suggestedScenarios && userScenarios === null) {
    setScenarioEditKey((k) => k + 1);
  }
}, [suggestedScenarios, userScenarios]);
```

`userScenarios` starts as `null` on every new ticker fetch. It becomes non-null when the user
manually edits a scenario. This ensures auto-application only fires once — when model output
first arrives and the user hasn't overridden anything. Do not replace this with a ref-based
flag — the nullability of `userScenarios` is the mechanism.

---

## 2. AbortController Pattern — Do Not Break

`useAssetData` uses `AbortController` to cancel in-flight requests on re-fetch:

```typescript
abortRef.current?.abort();
const controller = new AbortController();
abortRef.current = controller;
```

**Rules:**
- Always check `controller.signal.aborted` before setting state after an await
- Only call `setIsLoading(false)` in `finally` if the signal is NOT aborted
- Never remove the abort check — it prevents race conditions when the user types quickly

**Pattern to follow exactly:**
```typescript
try {
  const data = await fetch(url, { signal: controller.signal });
  if (controller.signal.aborted) return null; // ← REQUIRED
  setState(data);
} catch (err) {
  if (controller.signal.aborted) return null; // ← REQUIRED
  setError(err instanceof Error ? err.message : 'Unknown error');
} finally {
  if (!controller.signal.aborted) setIsLoading(false); // ← REQUIRED
}
```

The `cancelled` boolean flag (used in `useInflationData`, `useKantorRates`) is an equivalent
pattern for IIFE-based async effects.

---

## 3. localStorage — Always Wrap in try/catch

Browsers may throw on `localStorage.getItem/setItem` when:
- Storage is full (QuotaExceededError)
- Third-party storage is blocked (privacy settings, incognito mode)
- The browser is in a restrictive environment (CSP, sandboxed iframes)

**Always use the guard pattern:**
```typescript
function getInitialDark(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'true';
  } catch { /* ignore */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
```

Never call `localStorage` without a try/catch. Never throw from storage failure — silent
fallback is the correct behavior.

---

## 4. Debounce — Rationale and Usage

`useDebouncedValue` exists specifically to defer heavy client-side computations (GBM, Bootstrap,
HMM Monte Carlo) while keeping UI sliders responsive. The delay is intentional.

```typescript
const debouncedHorizon = useDebouncedValue(horizonMonths, 300);
```

**Do not:**
- Remove debouncing from inputs that feed into prediction models
- Reduce the delay below 150ms (predictions run in ~20–200ms depending on model)
- Add debouncing to inputs that only update lightweight display state

---

## 5. API Fallback Chains — Keep the Chain Intact

Several hooks implement a **proxy-first, direct-fallback** pattern:

```
/api/currency-rates (CF edge, 1-min cached) → direct Alior API → direct NBP API
/api/inflation (CF edge, cached) → direct ECB HICP API → NBP target constant
```

**Rules:**
- Always attempt the proxy first (reduces external API load and handles CORS for some APIs)
- If the proxy fails, fall back to direct API calls with `Promise.allSettled` (not `Promise.all`)
  to allow partial success
- Never remove the fallback chain — the app must work even if the CF edge is unavailable
- `Promise.allSettled` is required (not `Promise.all`) because one source failing is acceptable

---

## 6. Auto-Refresh Intervals

`useKantorRates` auto-refreshes every 60 seconds:
```typescript
const interval = setInterval(load, 60_000);
return () => { cancelled = true; clearInterval(interval); };
```

**Rules:**
- Always clear intervals in the effect cleanup function
- Set `cancelled = true` BEFORE `clearInterval` to prevent the already-enqueued callback
  from running after unmount
- Do not reduce the refresh interval below 30 seconds (rate-limiting concern)

---

## 7. Hook Dependencies — Common Pitfalls

- Use primitive values (`number`, `string`, `boolean`) as effect dependencies, not objects
- When depending on an array or object, use a stable derived value:
  ```typescript
  const seed = dataSeed(prices); // ← stable number, not prices array
  const prepared = useMemo(() => ({ logRet, seed }), [stockHistory, currentPrice, enabled]);
  ```
- Wrap expensive derivations in `useMemo` — never recompute log returns on every render
- For callbacks that should not change identity: `useCallback` with correct deps

---

## 8. Provider Layer (src/providers/)

Providers are thin fetch wrappers — no state, no React hooks.

- `twelveDataProvider.ts` — calls `/api/market-data` and translates errors to user-friendly messages
- `nbpProvider.ts` — fetches current USD/PLN mid rate directly from NBP

**Rules:**
- Providers must not import React
- Error translation happens in providers: raw HTTP errors → Polish user messages
- Providers accept `AbortSignal` and must propagate it to `fetch()` calls
