---
description: Color token rules for WCAG AA compliance. Apply when writing or reviewing any component with className props, color tokens, or dark mode classes.
applyTo: "src/components/**/*.tsx,src/pages/**/*.tsx"
---

# Color Token Rules — WCAG AA Compliance

## Quick Reference

Before applying any color class, check `src/tokens/colorPairings.ts` for the pre-computed contrast ratios.

### Safe dark mode text tokens (on dark surfaces)

| Token | Dark hex | Contrast on `bg-surface` (#1e2130) | Use for |
|-------|----------|-------------------------------------|---------|
| `dark:text-heading` | `#ffffff` | 16:1 ✅ | Titles, primary labels |
| `dark:text-on-dark` | `#ffffff` | 16:1 ✅ | Text on dark card surfaces |
| `dark:text-body` | `#d0d1d2` | 10.4:1 ✅ | Body copy, descriptions |
| `dark:text-on-dark-muted` | `#d0d1d2` | 10.4:1 ✅ | Secondary text on dark surfaces |
| `dark:text-muted` | `#8e95a8` | 5.3:1 ✅ | Labels, hints, helper text |

### Forbidden dark mode text tokens

| Token | Dark hex | Contrast on `bg-surface` | Why forbidden |
|-------|----------|--------------------------|---------------|
| `dark:text-faint` | `#4f5d75` | **2.4:1** ❌ | Fails WCAG AA — decorative only |

> `dark:text-faint` is an **ESLint error**. The rule fires on any className string containing it.

## Decision Rule

When uncertain between two text tokens, **pick the higher contrast one**.

```
Needs to be very visible     → dark:text-heading or dark:text-on-dark
Needs to be clearly readable → dark:text-body or dark:text-on-dark-muted
Secondary / helper text      → dark:text-muted
Purely decorative (no text)  → dark:text-faint (borders, separators only)
```

## Common patterns

```tsx
// ✅ Readable secondary label in dark mode
<span className="text-muted dark:text-muted">Ticker</span>

// ✅ Body text that flips in dark mode
<p className="text-body dark:text-on-dark-muted">Description…</p>

// ✅ Help icon — subtle but visible on hover
<HelpCircle className="text-muted dark:text-muted hover:text-body dark:hover:text-on-dark-muted" />

// ❌ LINT ERROR — dark:text-faint on readable text
<span className="text-muted dark:text-faint">Label</span>
//                              ^^^^^^^^^^^^ ESLint: "dark:text-faint fails WCAG AA"

// ✅ Purely decorative separator — dark:text-faint is fine
<span className="text-faint" aria-hidden="true">·</span>
```

## on-dark vs on-dark-muted

- `text-on-dark` / `dark:text-on-dark` — for text **on explicit dark surfaces** (`bg-surface-dark`, `bg-surface-dark-alt`)
- `text-on-dark-muted` / `dark:text-on-dark-muted` — same, but for secondary text on dark surfaces

Do NOT use `text-on-dark-muted` on light surfaces — it is near-white and becomes invisible.

## Validation

After any color change:
```bash
npm run test:contrast     # Contrast ratio CI gate (36 tests)
npm run lint              # ESLint dark:text-faint ban
```

Both run automatically in CI on every PR.
