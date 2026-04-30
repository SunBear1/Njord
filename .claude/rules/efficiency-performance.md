# Code Efficiency & Performance

## Computation Budget
- Client-side financial calculations must complete in <100ms for standard inputs.
- Monte Carlo (10k paths): MUST run in Web Worker. Never block main thread.
- GBM/Bootstrap scenario generation: <50ms for 3 scenarios on commodity hardware.
- If a calculation takes >16ms (one frame), defer with `useTransition` or move to worker.

## Algorithmic Rules
- Prefer single-pass algorithms over multiple `.map().filter().reduce()` chains.
- For financial timelines: pre-allocate arrays when length is known (`new Array(months)`).
- Avoid creating intermediate arrays in hot paths — use a single loop with accumulator.
- Cache expensive computations: NBP rates (per session), bond presets (24h), stock data (1h).

## Memory
- NEVER store full Monte Carlo path arrays (10k × N months) in component state.
- Store only summary statistics (percentiles, mean, min/max) from worker results.
- Clean up large objects in `useEffect` cleanup functions.
- For large datasets: process in chunks, emit partial results.

## Network
- AbortController on ALL fetch calls — cancel on unmount or input change.
- Debounce user inputs that trigger API calls: 300ms minimum (`useDebouncedValue`).
- NEVER fire parallel identical requests — deduplicate with request keys.
- Cache responses in hook state. Only refetch when inputs genuinely change.
- Stale-while-revalidate pattern: show cached data immediately, refresh in background.

## Bundle Size
- Dynamic imports for heavy modules: SheetJS (xlsx parsing), only loaded when user imports file.
- Tree-shake: import specific functions, never entire libraries (`import { format } from 'date-fns'` not `import * as dateFns`).
- NEVER add a dependency when a 10-line utility function suffices.
- Check bundle impact before adding any new library (`npm run build` and compare dist size).

## Rendering Performance
- Memoize only when measured: `React.memo` on list items re-rendering with same props.
- NEVER wrap every component in `React.memo` preemptively.
- Avoid object/array literals in JSX props (creates new references each render):
  ```tsx
  // ❌ Bad — new object every render
  <Chart config={{ color: 'blue' }} />

  // ✅ Good — stable reference
  const chartConfig = useMemo(() => ({ color: 'blue' }), []);
  <Chart config={chartConfig} />
  ```
- Key prop must be stable ID, never `Math.random()` or `Date.now()`.

## Web Worker (HMM Monte Carlo)
- `src/workers/sellAnalysis.worker.ts` — browser Web Worker, NOT Cloudflare Worker.
- Communication: structured clone (no transferables needed for numeric arrays at this scale).
- Always handle worker errors: `worker.onerror` callback.
- Terminate worker on component unmount.
- Progress reporting: emit interim percentile results every 1000 paths.

## Lazy Loading
- Routes: all loaded via `React.lazy()` in `src/routes.tsx`.
- xlsx parser: dynamically imported on first Etrade file upload.
- Chart components: keep in main bundle (they render immediately on page load).
- Heavy utility modules (HMM): imported only by worker file.

## Forbidden Performance Patterns
- ❌ `JSON.parse(JSON.stringify(obj))` for deep clone — use structuredClone or targeted spread
- ❌ Re-computing derived values on every render without `useMemo`
- ❌ `useEffect` → setState → re-render loop for derived state (compute inline or `useMemo`)
- ❌ Storing formatted strings in state (format during render from raw numbers)
- ❌ `.sort()` on original array (mutates) — always spread first: `[...arr].sort()`
- ❌ Synchronous file parsing on main thread for files >100KB
- ❌ Polling APIs on intervals — use event-driven refresh or user-triggered reload
