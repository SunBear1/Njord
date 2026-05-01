---
description: Web interface guidelines for accessibility, UX, and design compliance. Use when reviewing UI code, checking accessibility, or auditing design quality.
applyTo: "src/**/*.{tsx,css}"
---

# Web Interface Guidelines

Review UI code for compliance with web interface best practices.
Source: [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) (MIT)

## Accessibility

- Icon-only buttons need `aria-label`
- Form controls need `<label>` or `aria-label`
- Interactive elements need keyboard handlers (`onKeyDown`/`onKeyUp`)
- `<button>` for actions, `<a>` for navigation (not `<div onClick>`)
- Images need `alt` (or `alt=""` if decorative)
- Decorative icons need `aria-hidden="true"`
- Use semantic HTML before ARIA
- Headings hierarchical `<h1>`–`<h6>`

## Focus States

- Interactive elements need visible focus: `focus-visible:ring-*` or equivalent
- Never `outline-none` without focus replacement
- Use `:focus-visible` over `:focus`

## Forms

- Inputs need `autocomplete` and meaningful `name`
- Use correct `type` (`email`, `tel`, `url`, `number`) and `inputmode`
- Never block paste
- Labels clickable (`htmlFor` or wrapping)
- Disable spellcheck on emails, codes, usernames
- Submit button stays enabled until request starts; spinner during request
- Errors inline next to fields; focus first error on submit
- Placeholders end with `…` and show example pattern
- Warn before navigation with unsaved changes

## Animation

- Honor `prefers-reduced-motion`
- Animate `transform`/`opacity` only (compositor-friendly)
- Never `transition: all` — list properties explicitly
- Animations must be interruptible

## Typography

- `…` not `...`
- Curly quotes `"` `"` not straight `"`
- `font-variant-numeric: tabular-nums` for number columns/comparisons
- Use `text-wrap: balance` or `text-pretty` on headings

## Content Handling

- Text containers handle long content: `truncate`, `line-clamp-*`, or `break-words`
- Flex children need `min-w-0` to allow text truncation
- Handle empty states — don't render broken UI for empty data
- Anticipate short, average, and very long user inputs

## Images

- `<img>` needs explicit `width` and `height` (prevents CLS)
- Below-fold images: `loading="lazy"`
- Above-fold critical images: `fetchpriority="high"`

## Performance

- Large lists (>50 items): virtualize
- No layout reads in render (`getBoundingClientRect`, `offsetHeight`)
- Prefer uncontrolled inputs; controlled inputs must be cheap per keystroke
- Add `<link rel="preconnect">` for API domains

## Navigation & State

- URL reflects state — filters, tabs, pagination in query params
- Deep-link all stateful UI
- Destructive actions need confirmation or undo — never immediate

## Touch & Interaction

- `touch-action: manipulation` (prevents double-tap zoom delay)
- `overscroll-behavior: contain` in modals/drawers

## Dark Mode & Theming

- `color-scheme: dark` on `<html>` for dark themes
- `<meta name="theme-color">` matches page background
- Native `<select>`: explicit `background-color` and `color` in dark mode

## Anti-patterns (flag these)

- `user-scalable=no` or `maximum-scale=1` disabling zoom
- `transition: all`
- `outline-none` without focus-visible replacement
- `<div>` or `<span>` with click handlers (should be `<button>`)
- Images without dimensions
- Form inputs without labels
- Icon buttons without `aria-label`
- Hardcoded date/number formats (use `Intl.*`)

## Output Format (for reviews)

Group by file. Use `file:line` format. Terse findings:

```text
## src/Component.tsx

src/Component.tsx:42 - icon button missing aria-label
src/Component.tsx:55 - animation missing prefers-reduced-motion
```

---

## Njord UI Standards

### Layout

- **Desktop:** 2-column grid (inputs left, results right). Max content width 1400px.
- **Mobile (≤768px):** Single column, inputs stacked above results.
- **Spacing:** Consistent `gap-4` or `gap-6` between sections. Never mix.
- **Cards:** `bg-white rounded-lg border border-gray-200 p-4` — nothing more.

### Typography

- Headings: `text-lg font-semibold` or `text-xl font-bold` — max 2 heading sizes per view.
- Body: `text-sm` for data-dense areas, `text-base` for explanatory text.
- Numbers/values: `font-mono` or `tabular-nums` for alignment in tables and results.
- NEVER use `text-xs` for important data — only for secondary labels.

### Interactive Elements

- Buttons: Only 2 variants — primary (filled) and secondary (outline). No ghost, no link-style buttons.
- Inputs: Consistent height (`h-10`), clear focus ring, label always above (never floating labels).
- Sliders: Show current value prominently. Include min/max labels.
- Tabs/toggles: Clear active state with underline or filled background — never just color change.

### Data Display

- Numbers: Always formatted with proper separators (`fmtPLN`, `fmtUSD`).
- Tables: Zebra striping only if >5 rows. Right-align numeric columns.
- Charts: Max 3-4 colors per chart. Legend outside chart area. Label axes in Polish.
- Comparison results: Use green/red ONLY for profit/loss. Never for decorative purposes.

### Color Semantics

- Green (`text-profit`/`bg-profit-bg`): profit, positive outcome.
- Red (`text-loss`/`bg-loss-bg`): loss, negative outcome, tax amount.
- Blue (`text-neutral`/`bg-neutral-bg`): neutral information, links, primary actions.
- Amber (`text-warning`/`bg-warning-bg`): warnings, inflation impact, caveats.
- Gray: borders, disabled states, secondary text.
- NEVER use purple, pink, cyan, or teal.

### Loading States

- Skeleton screens for initial data load (gray rectangles matching content shape).
- Inline spinner (`animate-spin` on small circle) next to the element being loaded.
- NEVER block the entire page with a full-screen loader.
- Show stale data with a "refreshing..." indicator rather than blanking the screen.

### Error States

- Inline error messages below the relevant input (red text, `text-sm`).
- API errors: Banner at top of results area, not a modal or toast.
- Network errors: Show last cached data with amber "offline" indicator.
- NEVER use `alert()` or browser-native dialogs.
