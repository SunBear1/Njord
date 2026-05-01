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
