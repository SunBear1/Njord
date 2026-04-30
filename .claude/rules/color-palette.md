# Color Palette & Tailwind Design Tokens

## Source of Truth
All colors are defined in `src/index.css` via `@theme {}`. Components reference semantic tokens, never raw Tailwind color classes.

## Semantic Token Map

### Light Mode
```css
@theme {
  /* Surfaces */
  --color-surface-primary: /* white */
  --color-surface-secondary: /* gray-50 */
  --color-surface-elevated: /* white with border */

  /* Text */
  --color-text-primary: /* gray-900 */
  --color-text-secondary: /* gray-600 */
  --color-text-muted: /* gray-400 */

  /* Financial semantics */
  --color-profit: /* green-700 */
  --color-profit-bg: /* green-50 */
  --color-loss: /* red-700 */
  --color-loss-bg: /* red-50 */
  --color-neutral: /* blue-700 */
  --color-neutral-bg: /* blue-50 */
  --color-warning: /* amber-700 */
  --color-warning-bg: /* amber-50 */

  /* Interactive */
  --color-primary: /* blue-600 */
  --color-primary-hover: /* blue-700 */
  --color-border: /* gray-200 */
  --color-border-focus: /* blue-500 */

  /* Charts */
  --color-chart-stocks: /* blue-600 */
  --color-chart-savings: /* emerald-600 */
  --color-chart-bonds: /* amber-600 */
  --color-chart-inflation: /* orange-400 dashed */
}
```

## Rules

### Token Usage
- ALWAYS use semantic tokens for financial indicators (profit/loss/warning).
- NEVER use raw color classes (`text-green-600`) — use tokens (`text-profit`).
- When a new semantic need arises, add a token to `@theme` first, then use it.

### Chart Colors (Recharts)
- Maximum 4 series per chart. Each series gets one of the chart tokens.
- Stock portfolio: `--color-chart-stocks` (blue)
- Savings benchmark: `--color-chart-savings` (green)
- Bond benchmark: `--color-chart-bonds` (amber)
- Inflation/purchasing power: `--color-chart-inflation` (orange, dashed line)
- NEVER use Recharts default colors — always pass explicit colors from tokens.

### Forbidden Patterns
- ❌ `bg-gradient-to-*` — no gradients anywhere
- ❌ `from-*` / `to-*` / `via-*` — gradient stops
- ❌ Opacity variants below 0.5 on text (`text-*/50`) — illegible
- ❌ `ring-*` colors that differ from `--color-border-focus`
- ❌ Custom hex in `style={{}}` attributes
- ❌ Multiple shades of the same hue in one component (e.g., `blue-100` + `blue-200` + `blue-300`)

### Dark Mode
- Defined via `@media (prefers-color-scheme: dark)` in `@theme` overrides.
- Components do NOT add `dark:` prefixes — they use the same token names.
- If a component looks wrong in dark mode, fix the token definition, not the component.

### Contrast Requirements
| Context | Minimum Ratio |
|---------|--------------|
| Body text on surface | 4.5:1 |
| Large text (≥18px) | 3:1 |
| UI components (borders, icons) | 3:1 |
| Disabled elements | exempt (but must be distinguishable) |
| Chart labels | 4.5:1 against chart background |
