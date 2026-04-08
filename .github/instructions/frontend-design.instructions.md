---
description: Frontend design principles for distinctive, production-grade interfaces. Apply when building new UI components, pages, or redesigning existing interfaces.
globs: "src/components/**/*.tsx"
---

# Frontend Design

Create distinctive, production-grade frontend interfaces that avoid generic aesthetics.
Source: [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) (Licensed)

## Design Thinking

Before coding, understand the context:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick a clear aesthetic direction (minimal, editorial, refined, playful, etc.)
- **Constraints**: Technical requirements (framework, performance, accessibility)
- **Differentiation**: What makes this memorable?

Choose a clear conceptual direction and execute it with precision.

## Frontend Aesthetics

- **Typography**: Choose distinctive, beautiful fonts. Avoid generic fonts (Arial, Inter, Roboto). Pair a display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents > timid, evenly-distributed palettes.
- **Motion**: Focus on high-impact moments: page load with staggered reveals creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Atmosphere and depth rather than solid colors. Gradient meshes, noise textures, geometric patterns, layered transparencies.

## Project-Specific Notes (Njord)

This project uses a **refined financial dashboard** aesthetic:

- **Font**: System fonts (kept for performance — no external font loading)
- **Colors**: Defined as CSS custom properties in `src/index.css` via Tailwind v4 `@theme` — use semantic tokens (`--color-bg-primary`, `--color-text-secondary`, etc.)
- **Tone**: Professional, data-dense, trustworthy — similar to Bloomberg/Morningstar
- **Charts**: Recharts library — use consistent color palette from CSS variables
- **Cards**: White backgrounds, subtle borders, rounded-xl, shadow-sm
- **Accents**: Blue for stocks, purple for benchmarks, amber for base, red/green for bear/bull scenarios

## Do NOT

- Use generic AI aesthetics (purple gradients on white, cookie-cutter layouts)
- Mix multiple unrelated color schemes
- Add decorative elements that don't serve the financial data context
- Use animations that distract from data readability
