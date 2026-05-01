---
description: Design token architecture for theming and dark mode preparation. Apply when working with colors, theming, or CSS custom properties.
applyTo: "src/index.css"
---

# Design Token Architecture

Three-layer token system for consistent theming and dark mode support.
Adapted from: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT)

## Three-Layer Structure

```
Primitive (raw values)     →  --color-blue-600: #2563EB
       ↓
Semantic (purpose aliases) →  --color-accent-info: var(--color-blue-600)
       ↓
Component (component-specific) →  --button-bg: var(--color-accent-info)
```

## Current State (Njord)

Tokens are defined in `src/index.css` via Tailwind v4 `@theme {}`:

**Brand & scenario colors:**
- `--color-brand`, `--color-bear`, `--color-base`, `--color-bull`

**Semantic surface tokens:**
- `--color-bg-primary` (page background)
- `--color-bg-secondary`, `--color-bg-card`, `--color-bg-muted`

**Semantic text tokens:**
- `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-faint`

**Semantic border tokens:**
- `--color-border`, `--color-border-strong`

**Accent colors:**
- `--color-accent-info`, `--color-accent-warning`, `--color-accent-success`, `--color-accent-error`

## Rules

1. **Never use raw hex in components** — always reference tokens via `var(--color-*)` or Tailwind classes that map to tokens
2. **Semantic layer enables theme switching** — light↔dark is just reassigning semantic tokens
3. **New colors**: Add to `@theme` in `index.css`, not inline in components
4. **Tailwind v4**: Uses `@theme` block (not `tailwind.config.js`) for custom properties
5. **Chart colors**: Currently hardcoded hex in Recharts components — should be migrated to CSS variables when implementing dark theme

## Financial Semantic Tokens

These tokens carry domain meaning — always use them instead of raw color classes:

```css
@theme {
  /* Financial outcomes */
  --color-profit: /* green-700 */;
  --color-profit-bg: /* green-50 */;
  --color-loss: /* red-700 */;
  --color-loss-bg: /* red-50 */;
  --color-neutral: /* blue-700 */;
  --color-neutral-bg: /* blue-50 */;
  --color-warning: /* amber-700 */;
  --color-warning-bg: /* amber-50 */;

  /* Chart series */
  --color-chart-stocks: /* blue-600 */;
  --color-chart-savings: /* emerald-600 */;
  --color-chart-bonds: /* amber-600 */;
  --color-chart-inflation: /* orange-400 (dashed line) */;
}
```

- ALWAYS use semantic tokens for financial indicators — never `text-green-600`, use `text-profit`.
- Chart series assignment: stocks → `--color-chart-stocks` (blue), savings → `--color-chart-savings` (green), bonds → `--color-chart-bonds` (amber), inflation → `--color-chart-inflation` (orange, dashed).
- Maximum 4 series per chart. NEVER use Recharts default colors — pass explicit colors from tokens.
- When a new semantic need arises, add a token to `@theme` first, then use it.

## Dark Mode

- Defined via `@media (prefers-color-scheme: dark)` in `@theme` overrides.
- Components do NOT add `dark:` prefixes — they use the same token names.
- If a component looks wrong in dark mode, fix the token definition, not the component.

## Contrast Requirements

| Context | Minimum Ratio |
|---------|--------------|
| Body text on surface | 4.5:1 |
| Large text (≥18px) | 3:1 |
| UI components (borders, icons) | 3:1 |
| Chart labels | 4.5:1 against chart background |
| Disabled elements | exempt (but must be distinguishable) |

## Forbidden Patterns

- ❌ `bg-gradient-to-*` — no gradients anywhere
- ❌ `from-*` / `to-*` / `via-*` — gradient stops
- ❌ Opacity variants below 0.5 on text (`text-*/50`) — illegible
- ❌ `ring-*` colors that differ from `--color-border-focus`
- ❌ Custom hex in `style={{}}` attributes
- ❌ Multiple shades of the same hue in one component (e.g., `blue-100` + `blue-200` + `blue-300`)
- ❌ Raw color classes for profit/loss — use semantic tokens (`text-profit`, not `text-green-700`)


## Dark Theme Migration Path

A commented-out `@media (prefers-color-scheme: dark)` block already exists in `index.css`.

To implement dark theme:
1. Uncomment and adjust the dark mode block in `index.css`
2. Replace remaining hardcoded Tailwind color classes with CSS variable references
3. Start with major surfaces (App.tsx, card backgrounds), then progressively migrate
4. Chart colors in Recharts need to become dynamic props
5. Add `color-scheme: dark` on `<html>` element
6. Add `<meta name="theme-color">` matching page background

## Token Compliance Check

```css
/* CORRECT */
background: var(--color-bg-card);
color: var(--color-text-primary);

/* WRONG — hardcoded, won't adapt to dark theme */
background: #ffffff;
color: #111827;
```
