# React Development Rules

## React 19 Conventions
- `use()` hook for context consumption — NEVER `useContext()`.
- `ref` as a regular prop — NEVER `forwardRef()`.
- Use `useTransition` for non-urgent state updates (e.g., scenario recalculation).
- Use `useDeferredValue` for expensive derived computations shown in UI.

## Component Architecture
- **Pages** (`src/pages/`): Own all state for their route. Fetch data via hooks. Pass data down as props.
- **Components** (`src/components/`): Pure display + local interaction state only. Never fetch data.
- **Hooks** (`src/hooks/`): Data fetching, subscriptions, complex state logic. Return typed objects.
- **Utils** (`src/utils/`): Pure functions. Zero React imports. Zero side effects.

## Props & Types
- Every component has a named `interface` for props (e.g., `interface ComparisonChartProps`).
- NEVER use inline prop types: `(props: { x: number; y: string })` — always extract to interface.
- NEVER use `React.FC` — just type the props parameter directly.
- Export prop interfaces when components are used across pages.
- Optional props must have sensible defaults via destructuring defaults, not `defaultProps`.

## State Management
- NO global state libraries (Redux, Zustand, Jotai, Recoil, MobX).
- State lives in page components, passed via props.
- For deeply nested prop drilling (>3 levels): extract to a composition pattern or compound component.
- `localStorage` access ONLY in dedicated persistence utilities (`persistedState.ts`, `useWizardState.ts`).

## Hooks Rules
- Custom hooks MUST start with `use` and return a well-typed object (not arrays).
- `useEffect` dependencies: ALWAYS explicit. NEVER disable the exhaustive-deps rule.
- `useEffect` cleanup: ALWAYS return cleanup for subscriptions, timers, AbortControllers.
- AbortController pattern for ALL fetch calls — cancel on unmount or dependency change.
- NEVER call `setState` inside `useEffect` without a condition guard (prevents infinite loops).
- Prefer `useMemo`/`useCallback` ONLY when: passing to memoized children, or computation is measurably expensive (>1ms).

## Rendering
- NEVER mutate state directly — always create new objects/arrays.
- Key prop: Use stable, unique identifiers (never array index unless list is static and never reordered).
- Conditional rendering: Ternary for simple cases, early return for complex branching.
- NEVER render inside a loop without a key.
- Lists: Use `.map()` directly in JSX. Extract `<ListItem>` component if item rendering exceeds 10 lines.

## Error Handling
- Wrap route-level components with `<ErrorBoundary>`.
- API errors: Catch in hooks, expose via `{ error, isLoading, data }` pattern.
- User input validation: Validate on blur, show error below input.
- NEVER swallow errors with empty `catch {}` — at minimum `console.error`.
- NEVER show raw error messages to users — translate to Polish user-friendly text.

## Performance
- Lazy-load routes with `React.lazy()` + `Suspense`.
- Heavy computations (Monte Carlo, HMM): Offload to Web Worker.
- Images: Use `loading="lazy"` attribute.
- Large lists (>100 items): Consider virtualization — but don't add until actually needed.
- NEVER premature-optimize — measure first with React DevTools Profiler.

## File Organization
- One component per file. File name = component name (PascalCase).
- Co-locate component-specific types at top of file (or in `types/` if shared).
- Hooks: one hook per file in `src/hooks/`.
- Tests: mirror source structure in `src/__tests__/`.

## Import Order
1. React and react-dom
2. Third-party libraries (recharts, lucide-react)
3. Local components (relative `./` or `../`)
4. Hooks
5. Utils
6. Types
7. Constants/data

## Forbidden Patterns
- ❌ `useEffect` as a state synchronization mechanism (derive state instead)
- ❌ `any` type (use `unknown` + narrowing)
- ❌ `// @ts-ignore` or `// @ts-expect-error` without linked issue
- ❌ `dangerouslySetInnerHTML` without explicit sanitization
- ❌ Direct DOM manipulation (`document.querySelector`, `getElementById`)
- ❌ `window.location` for navigation — use react-router hooks
- ❌ Barrel files (`index.ts` re-exporting everything) — import directly from source
- ❌ Prop spreading (`{...props}`) on HTML elements — explicit props only
- ❌ `setTimeout`/`setInterval` without cleanup in `useEffect`
