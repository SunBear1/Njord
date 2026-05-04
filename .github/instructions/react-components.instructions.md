---
description: Component design, React patterns, Tailwind, accessibility, colors.
applyTo: "src/components/**/*.tsx,src/pages/**/*.tsx"
---

# React Components

## Component Architecture

Functional + hooks. Props via named interfaces. React 19: `use()` not `useContext()`, `ref` as prop.

File size limits: components <300 lines, pages <300 lines.

## Composition Over Boolean Props

❌ Bad: `<Panel showHeader showFooter isCompact />`  
✅ Good: Extract sub-components or use compound pattern.

Avoid boolean proliferation — each boolean doubles possible states.

## Tailwind CSS v4

**Only:** Utility classes in `className`. No CSS modules, styled-components, `style={{}}` (except dynamic values).

**Class order:** Layout → Sizing → Spacing → Typography → Colors → Effects → States → Responsive  
**Responsive:** Mobile-first, `md:` and `lg:` only (test at 375px and 1280px)  
**Spacing:** Standard scale only (1,2,3,4,5,6,8,10,12,16,20,24). No arbitrary (`gap-[13px]`)  
**Animation:** `animate-spin`, `transition-colors`, `transition-opacity` only (duration-150/200 max). NO bounce/pulse/ping.

## Color Tokens (from src/index.css)

**Always use semantic tokens:**
- Backgrounds: `--color-bg-primary`, `--color-bg-card`, `--color-bg-muted`
- Text: `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`
- Financial: `--color-profit` (green), `--color-loss` (red), `--color-neutral` (blue)
- Charts: `--color-chart-stocks` (blue), `--color-chart-savings` (green), `--color-chart-bonds` (amber)

❌ Forbidden: Gradients, opacity <0.5 on text, hardcoded hex, raw color classes for financial context

**Dark mode:** Token changes only (via `@media prefers-color-scheme: dark` in `index.css`). No `dark:` prefixes in components.

## WCAG AA Contrast

- Body text: 4.5:1
- Large text (18px+): 3:1
- UI components: 3:1

Test with axe, WAVE, or Lighthouse.

## Accessibility

- Semantic HTML: `<button>`, `<nav>`, `<main>`, not `<div role="button">`
- Form labels: `htmlFor` + `id`
- Icon buttons: `aria-label` (Lucide icons are decorative by default)
- Tab order matches visual order
- Polish text: no typos, correct cases (nominative/genitive/locative)

## Njord Aesthetic

Refined financial dashboard. Clarity > flashiness. System fonts, dense data, trustworthy tone.

**Anti-slop UI:**
- ❌ Gradients, rounded-full buttons with emoji, bouncing loaders, glass-morphism, shadows >shadow-sm, excessive rounding, decorative SVGs, confetti, hover scale, rainbow icons, purple/pink/cyan/teal

Every pixel must serve a purpose.

## Performance

Memoize only when measured (list items with same props). Never wrap all components in `React.memo` preemptively.

Avoid object/array literals in JSX props — use `useMemo` for stable references. Key prop must be stable ID, never `Math.random()`.
