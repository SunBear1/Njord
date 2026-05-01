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
