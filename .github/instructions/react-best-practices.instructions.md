---
description: React performance optimization guidelines from Vercel Engineering. Apply when writing, reviewing, or refactoring React components.
applyTo: "src/**/*.{ts,tsx}"
---

# React Best Practices

Comprehensive performance optimization guide for React applications.
Source: [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) (MIT)

## When to Apply

- Writing new React components
- Implementing data fetching (client-side)
- Reviewing code for performance issues
- Refactoring existing React code
- Optimizing bundle size or load times

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Eliminating Waterfalls | CRITICAL | `async-` |
| 2 | Bundle Size Optimization | CRITICAL | `bundle-` |
| 3 | Client-Side Data Fetching | MEDIUM-HIGH | `client-` |
| 4 | Re-render Optimization | MEDIUM | `rerender-` |
| 5 | Rendering Performance | MEDIUM | `rendering-` |
| 6 | JavaScript Performance | LOW-MEDIUM | `js-` |

> Note: Server-side (SSR/RSC) and Next.js-specific rules omitted — this project is a client-only Vite SPA.

## 1. Eliminating Waterfalls (CRITICAL)

- **Check cheap sync conditions before async**: Don't `await` a flag fetch if a local variable already tells you the answer.
- **Move `await` into branches**: If only one branch needs the result, don't await at the top.
- **`Promise.all()` for independent operations**: Never await sequentially when operations don't depend on each other.
- **Use Suspense boundaries**: Stream content that has async dependencies separately.

## 2. Bundle Size Optimization (CRITICAL)

- **Import directly, avoid barrel files**: `import { X } from './utils/X'` not `import { X } from './utils'`.
- **Dynamic imports for heavy components**: Use `React.lazy()` for components not needed on initial render.
- **Defer third-party scripts**: Load analytics/logging after initial render.
- **Conditional module loading**: Load modules only when a feature is activated.

## 3. Client-Side Data Fetching (MEDIUM-HIGH)

- **Deduplicate requests**: Use SWR or React Query for automatic request deduplication.
- **Deduplicate global event listeners**: Don't add multiple listeners for the same event.
- **Use passive event listeners for scroll**: `{ passive: true }` on scroll/touch handlers.
- **Version localStorage data**: Schema-version your localStorage to avoid stale data bugs.

## 4. Re-render Optimization (MEDIUM)

- **Don't subscribe to state only used in callbacks**: Use refs for values only read in event handlers.
- **Extract expensive work into memoized components**: `React.memo()` for pure display components.
- **Hoist default non-primitive props**: Define default objects/arrays outside the component.
- **Use primitive dependencies in effects**: Avoid object/array deps in `useEffect`.
- **Subscribe to derived booleans, not raw values**: `const isOpen = count > 0` is cheaper than subscribing to `count`.
- **Derive state during render, not effects**: No `useEffect` to sync derived state — compute it inline.
- **Use functional setState for stable callbacks**: `setCount(c => c + 1)` avoids stale closures.
- **Pass function to useState for expensive init**: `useState(() => computeExpensiveDefault())`.
- **Don't define components inside components**: Causes remount on every parent render.
- **Use `useRef` for transient frequent values**: Mouse position, scroll offset — don't trigger re-renders.

## 5. Rendering Performance (MEDIUM)

- **Animate div wrapper, not SVG element**: SVG transforms are expensive.
- **Use `content-visibility: auto`** for long lists below the fold.
- **Extract static JSX outside components**: Constant JSX doesn't need to be in the render function.
- **Use ternary, not `&&`** for conditional rendering: `{condition ? <X /> : null}` not `{condition && <X />}`.

## 6. JavaScript Performance (LOW-MEDIUM)

- **Build `Map`/`Set` for repeated lookups**: O(1) vs O(n) for `.find()` / `.includes()`.
- **Cache object property access in loops**: Store `obj.prop` in a variable before iterating.
- **Combine multiple filter/map into one loop**: Single pass is faster.
- **Check array length before expensive comparison**: Early exit on empty arrays.
- **Use `flatMap`** to map and filter in one pass.
- **Hoist RegExp creation outside loops**.

---

## Njord-Specific React Rules

### React 19 Conventions

- `use()` for context consumption — NEVER `useContext()`.
- `ref` as a regular prop — NEVER `forwardRef()`.
- `useTransition` for non-urgent state updates (e.g., scenario recalculation).
- `useDeferredValue` for expensive derived computations shown in UI.

### Component Architecture

- **Pages** (`src/pages/`): Own all state for their route. Fetch data via hooks. Pass data down as props.
- **Components** (`src/components/`): Pure display + local interaction state only. Never fetch data.
- **Hooks** (`src/hooks/`): Data fetching, subscriptions, complex state logic. Return typed objects.
- **Utils** (`src/utils/`): Pure functions. Zero React imports. Zero side effects.

### Props & Types

- Every component has a named `interface` for props (e.g., `interface ComparisonChartProps`).
- NEVER use inline prop types: `(props: { x: number })` — always extract to interface.
- NEVER use `React.FC` — type the props parameter directly.
- Export prop interfaces when components are used across pages.

### State Management

- NO global state libraries (Redux, Zustand, Jotai, Recoil, MobX).
- State lives in page components, passed via props.
- `localStorage` access ONLY in dedicated persistence utilities (`persistedState.ts`, `useWizardState.ts`).

### Hooks Rules

- Custom hooks MUST start with `use` and return a well-typed object (not arrays).
- `useEffect` dependencies: ALWAYS explicit. NEVER disable the exhaustive-deps rule.
- `useEffect` cleanup: ALWAYS return cleanup for subscriptions, timers, AbortControllers.
- NEVER call `setState` inside `useEffect` without a condition guard (prevents infinite loops).

### Error Handling

- Wrap route-level components with `<ErrorBoundary>`.
- API errors: Catch in hooks, expose via `{ error, isLoading, data }` pattern.
- NEVER swallow errors with empty `catch {}` — at minimum `console.error`.
- NEVER show raw error messages to users — translate to Polish user-friendly text.

### File Organization

- One component per file. File name = component name (PascalCase).
- Hooks: one hook per file in `src/hooks/`.
- Tests: mirror source structure in `src/__tests__/`.

### Import Order

1. React and react-dom
2. Third-party libraries (recharts, lucide-react)
3. Local components (relative `./` or `../`)
4. Hooks → Utils → Types → Constants

### Forbidden Patterns

- ❌ `useEffect` as a state synchronization mechanism (derive state instead)
- ❌ `any` type (use `unknown` + narrowing)
- ❌ `// @ts-ignore` without linked issue
- ❌ `dangerouslySetInnerHTML` without explicit sanitization
- ❌ Direct DOM manipulation (`document.querySelector`, `getElementById`)
- ❌ `window.location` for navigation — use react-router hooks
- ❌ Barrel files (`index.ts` re-exporting everything) — import directly from source
- ❌ Prop spreading (`{...props}`) on HTML elements — explicit props only
- ❌ `setTimeout`/`setInterval` without cleanup in `useEffect`
