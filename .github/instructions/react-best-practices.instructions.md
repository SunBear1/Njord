---
description: React performance optimization guidelines from Vercel Engineering. Apply when writing, reviewing, or refactoring React components.
globs: "src/**/*.{ts,tsx}"
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
