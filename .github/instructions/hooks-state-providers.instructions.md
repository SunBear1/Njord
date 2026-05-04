---
description: State management, React hooks, and data providers.
applyTo: "src/hooks/**/*.ts,src/providers/**/*.ts"
---

# Hooks & State

## Page-Level State Only

No Redux, Zustand, Context stores. Each page owns its state. Pass via props to children.

**Auto-apply pattern:** `userScenarios ?? suggestedScenarios ?? DEFAULT_SCENARIOS`. Use `null` sentinel to detect first auto-apply; user overrides set non-null.

## AbortController Pattern

```typescript
try {
  const data = await fetch(url, { signal: controller.signal });
  if (controller.signal.aborted) return null; // ← REQUIRED
  setState(data);
} catch (err) {
  if (controller.signal.aborted) return null; // ← REQUIRED
  setError(err?.message || 'Unknown error');
} finally {
  if (!controller.signal.aborted) setIsLoading(false); // ← REQUIRED
}
```

Never remove the abort checks — prevents race conditions on quick re-fetches.

## localStorage Always Wrapped

```typescript
try {
  const val = localStorage.getItem(key);
  return val !== null ? JSON.parse(val) : default;
} catch { return default; } // Silent fallback
```

Never throw on storage failure. Browsers may deny access (quotaexceeded, incognito, CSP).

## Debounce Network Inputs

`useDebouncedValue(horizonMonths, 300)` — minimum 150ms delay for prediction models.  
Do NOT debounce lightweight display state.

## API Fallback Chains (Keep Intact)

Proxy-first, then direct fallbacks. Use `Promise.allSettled` (not `.all`) for partial success. Example: `/api/currency-rates` → Alior direct → NBP direct.

## Auto-Refresh Intervals

```typescript
const interval = setInterval(load, 60_000);
return () => { cancelled = true; clearInterval(interval); };
```

Always clear in cleanup. Set `cancelled` BEFORE `clearInterval` (prevents post-unmount callback).

## Hook Dependencies (Stability)

Use primitive values (`number`, `string`, `boolean`). For arrays/objects, use derived stable values: `const seed = dataSeed(prices); useMemo(() => ({ seed }), [prices])`.

## Providers (src/providers/)

No React imports. Accept `AbortSignal`. Translate errors to Polish user messages.  
Example: `twelveDataProvider`, `nbpProvider` — thin fetch wrappers.

## Network Rules

- Debounce: 300ms minimum
- No parallel identical requests (deduplicate)
- Cache responses; refetch only on input change
- Stale-while-revalidate: show cached, refresh background
