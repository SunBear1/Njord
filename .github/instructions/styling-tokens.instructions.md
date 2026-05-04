---
description: Design token architecture for theming and dark mode preparation. Apply when working with colors, theming, or CSS custom properties.
applyTo: "src/index.css,src/tokens/**/*.ts"
---

# Design Tokens & Styling

## Three-Layer Token Structure

```
Primitive (raw values)     →  --color-blue-600: #2563EB
       ↓
Semantic (purpose aliases) →  --color-accent-info: var(--color-blue-600)
       ↓
Component (component-specific) →  --button-bg: var(--color-accent-info)
```

Tokens defined in `src/index.css` via Tailwind v4 `@theme {}`.

## Current Tokens (Njord)

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

**Financial semantic tokens:**
- `--color-profit` (green), `--color-loss` (red), `--color-neutral` (blue), `--color-warning` (amber)
- `--color-chart-stocks` (blue), `--color-chart-savings` (green), `--color-chart-bonds` (amber), `--color-chart-inflation` (orange)

## Rules

1. **Never use raw hex in components** — always reference tokens via `var(--color-*)` or Tailwind classes that map to tokens
2. **Semantic layer enables theme switching** — light↔dark is reassigning semantic tokens
3. **New colors**: Add to `@theme` in `index.css`, not inline in components
4. **Tailwind v4**: Uses `@theme` block (not `tailwind.config.js`)
5. **Chart colors**: Always use CSS variables via `strokeOpacity`, `fill`, not hardcoded hex
6. **Financial tokens only**: Use `text-profit`, `bg-loss` — never `text-green-700`, `bg-red-50`
7. **Maximum 4 chart series per chart**. NEVER use Recharts default colors — pass explicit token colors

## Dark Mode

- Defined via `@media (prefers-color-scheme: dark)` in `@theme` overrides
- Components do NOT add `dark:` prefixes — they use the same token names
- If a component looks wrong in dark mode, fix the token definition, not the component

## Contrast

Body text: 4.5:1. Large text (18px+): 3:1. Components: 3:1. Disabled: distinguishable.

## Forbidden Patterns

- ❌ `bg-gradient-to-*`, `from-*`, `to-*` — no gradients
- ❌ Opacity <0.5 on text (`text-*/50`) — illegible
- ❌ `ring-*` colors differing from `--color-border-focus`
- ❌ Custom hex in `style={{}}` attributes
- ❌ Multiple shades of same hue in one component (e.g., `blue-100` + `blue-200` + `blue-300`)
- ❌ Raw color classes for profit/loss — use semantic tokens
