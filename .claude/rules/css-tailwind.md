# CSS & Tailwind Rules

## Tailwind v4 Only
- All styling via Tailwind utility classes in JSX `className`.
- No CSS modules, no styled-components, no emotion, no inline `style={{}}` (except dynamic values from calculations like chart dimensions).
- No `@apply` in CSS files — defeats the purpose of utility-first.

## Class Organization
Order classes consistently in this sequence:
1. Layout (`flex`, `grid`, `block`, `relative`)
2. Sizing (`w-*`, `h-*`, `min-*`, `max-*`)
3. Spacing (`p-*`, `m-*`, `gap-*`)
4. Typography (`text-*`, `font-*`, `leading-*`)
5. Colors (`bg-*`, `text-*`, `border-*`)
6. Effects (`shadow-*`, `rounded-*`, `opacity-*`)
7. States (`hover:*`, `focus:*`, `disabled:*`)
8. Responsive (`sm:*`, `md:*`, `lg:*`)

## Responsive Design
- Mobile-first: base classes for mobile, `md:` for tablet, `lg:` for desktop.
- Breakpoints used: `md` (768px) and `lg` (1024px) only. Never `sm`, `xl`, `2xl`.
- Test at exactly 375px (iPhone SE) and 1280px (laptop).
- Navigation: collapsible on mobile, full navbar on desktop.

## Spacing System
- Use only the standard Tailwind scale: 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24.
- Consistent gaps: `gap-4` within sections, `gap-6` between sections, `gap-8` between major areas.
- NEVER use arbitrary values (`gap-[13px]`) — pick the nearest standard value.

## Component Patterns

### Card
```tsx
<div className="rounded-lg border border-border bg-surface-primary p-4">
  {/* content */}
</div>
```

### Section Heading
```tsx
<h2 className="text-lg font-semibold text-text-primary mb-4">
  {/* Polish label */}
</h2>
```

### Input Group
```tsx
<div className="flex flex-col gap-1">
  <label className="text-sm font-medium text-text-secondary">{label}</label>
  <input className="h-10 rounded-md border border-border px-3 text-sm focus:border-border-focus focus:ring-1 focus:ring-border-focus" />
</div>
```

### Result Value (positive)
```tsx
<span className="font-mono text-profit">{fmtPLN(value)}</span>
```

## Forbidden Patterns
- ❌ `className={styles.something}` — no CSS modules
- ❌ `styled.div` or `css` template literals
- ❌ `!important` anywhere
- ❌ Inline styles for colors, spacing, or typography
- ❌ Arbitrary Tailwind values (`w-[347px]`) — exception: chart containers with calculated dimensions
- ❌ `@apply` in any `.css` file
- ❌ Nesting in CSS beyond `@theme` and `@media`
- ❌ `clsx`/`classnames` with more than 3 conditions — extract to a named variable or component

## Animation
- Only allowed: `animate-spin` (loaders), `transition-colors` (hover states), `transition-opacity` (fade in/out).
- Duration: `duration-150` or `duration-200` max.
- NEVER: `animate-bounce`, `animate-pulse` (except skeleton screens), `animate-ping`, custom keyframes.
- No layout-shifting animations (no `transition-all`, no height/width transitions).
