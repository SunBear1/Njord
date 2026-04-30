# UI/UX Design & Visual Quality

## Design Philosophy
- This is a financial tool. Prioritize **clarity, density, and trust** over flashiness.
- Every pixel must serve a purpose — no decorative gradients, no gratuitous animations, no "hero sections."
- Information hierarchy through typography weight and spacing, not color overload.

## Anti-Slop Checklist
Before writing any UI code, verify NONE of these are present:
- ❌ Gradient backgrounds on cards or sections
- ❌ Rounded-full buttons with emoji icons (the "AI startup" look)
- ❌ Bouncing/pulsing loading indicators (use simple spinner or skeleton)
- ❌ "Glass morphism" / backdrop-blur on containers
- ❌ Drop shadows deeper than `shadow-sm` on cards
- ❌ Excessive border-radius (max `rounded-lg` for cards, `rounded-md` for inputs)
- ❌ Placeholder illustrations or decorative SVGs
- ❌ "Empty state" illustrations with cartoon characters
- ❌ Confetti, celebrations, or success animations
- ❌ Tooltips on everything — use inline help text sparingly
- ❌ Hover scale transforms on cards (`hover:scale-105` etc.)
- ❌ Rainbow or multi-color icon sets — use monochrome Lucide icons

## Layout Principles
- **Desktop:** 2-column grid (inputs left, results right). Max content width 1400px.
- **Mobile (≤768px):** Single column, inputs stacked above results.
- **Spacing:** Consistent `gap-4` or `gap-6` between sections. Never mix.
- **Cards:** `bg-white rounded-lg border border-gray-200 p-4` — nothing more.
- **Dark mode cards:** Use semantic tokens from `@theme`, never raw `dark:` prefixes on individual elements.

## Typography
- Headings: `text-lg font-semibold` or `text-xl font-bold` — max 2 heading sizes per view.
- Body: `text-sm` for data-dense areas, `text-base` for explanatory text.
- Numbers/values: `font-mono` or `tabular-nums` for alignment in tables and results.
- NEVER use `text-xs` for important data — only for secondary labels.

## Interactive Elements
- Buttons: Only 2 variants — primary (filled) and secondary (outline). No ghost, no link-style buttons.
- Inputs: Consistent height (`h-10`), clear focus ring, label always above (never floating labels).
- Sliders: Show current value prominently. Include min/max labels.
- Tabs/toggles: Clear active state with underline or filled background — never just color change.

## Data Display
- Numbers: Always formatted with proper separators (`fmtPLN`, `fmtUSD`).
- Tables: Zebra striping only if >5 rows. Right-align numeric columns.
- Charts: Max 3-4 colors per chart. Legend outside chart area. Label axes in Polish.
- Comparison results: Use green/red ONLY for profit/loss. Never for decorative purposes.

## Color Usage
- Green (`text-green-700`/`bg-green-50`): profit, positive outcome, "stocks win"
- Red (`text-red-700`/`bg-red-50`): loss, negative outcome, tax amount
- Blue (`text-blue-700`/`bg-blue-50`): neutral information, links, primary actions
- Amber (`text-amber-700`/`bg-amber-50`): warnings, inflation impact, caveats
- Gray: everything else — borders, disabled states, secondary text
- NEVER use purple, pink, cyan, or teal — they have no semantic meaning in this app.

## Accessibility
- All interactive elements must be keyboard-navigable.
- Color is never the ONLY indicator — pair with icons or text.
- Contrast ratio ≥4.5:1 for text, ≥3:1 for large text and UI components.
- `aria-label` on icon-only buttons. `aria-live="polite"` on dynamic result regions.

## Loading States
- Skeleton screens for initial data load (gray rectangles matching content shape).
- Inline spinner (`animate-spin` on small circle) next to the element being loaded.
- NEVER block the entire page with a full-screen loader.
- Show stale data with a "refreshing..." indicator rather than blanking the screen.

## Error States
- Inline error messages below the relevant input (red text, `text-sm`).
- API errors: Banner at top of results area, not a modal or toast.
- Network errors: Show last cached data with amber "offline" indicator.
- NEVER use `alert()` or browser-native dialogs.
