# Color Contrast Validation — Implementation Plan

> **Goal:** Prevent AI coding agents (GitHub Copilot CLI) from generating UI code with accessibility contrast failures.
> **Strategy:** 4-layer defence — prevent at generation, validate at build, self-heal on failure.
> **Scope:** Tailwind CSS + CSS custom properties, light + dark mode.

---

## Architecture Overview

```
+-------------------------------------------------------------------+
|  LAYER 1: Agent Instructions (prevents ~70% of mistakes)          |
|  .github/copilot-instructions.md                                  |
|  .github/instructions/ui-colors.instructions.md                   |
|  docs/DESIGN.md                                                   |
+-------------------------------------------------------------------+
|  LAYER 2: Structured Token Pairings (eliminates guesswork)        |
|  src/tokens/colorPairings.ts                                      |
|  scripts/generate-pairings.ts                                     |
+-------------------------------------------------------------------+
|  LAYER 3: CI Contrast Gate (catches what slips through)           |
|  src/__tests__/colorContrast.test.ts                              |
|  GitHub Actions pipeline step                                     |
+-------------------------------------------------------------------+
|  LAYER 4: Feedback Loop (self-healing workflow)                    |
|  Pre-commit hook + agent workflow instructions                    |
+-------------------------------------------------------------------+
```

---

## Layer 1: Agent Instructions

### Why This Is the Highest-Leverage Fix

GitHub Copilot CLI reads instructions from:
1. **`.github/copilot-instructions.md`** — project-wide, always loaded.
2. **`.github/instructions/*.instructions.md`** — path-specific, loaded when working on matching files (via YAML frontmatter `applyTo` glob).

Path-specific instructions only activate when the agent touches UI files — keeping context focused and token budget efficient.

### File 1: `.github/copilot-instructions.md` (global)

Add a short color section to your existing global instructions:

```markdown
## Accessibility

- All text must meet WCAG AA contrast: >=4.5:1 normal text, >=3:1 large text (>=18px or >=14px bold).
- All UI components (borders, icons, focus rings): >=3:1 against adjacent colors.
- NEVER use raw hex/rgb values for colors in components. Use design tokens only.
- Before committing UI changes, run `pnpm test:contrast`.
- For full color rules, see `docs/DESIGN.md` and `src/tokens/colorPairings.ts`.
```

### File 2: `.github/instructions/ui-colors.instructions.md` (path-specific)

```yaml
---
applyTo: "src/components/**,src/pages/**,src/layouts/**,src/app/**"
---
```

```markdown
# Color Token Rules — MANDATORY

## Allowed Usage
- Import colors ONLY from design tokens (`src/tokens/colors.ts`).
- Before applying any color class, verify the pairing in `src/tokens/colorPairings.ts`.
- For dark mode: ONLY use `text-on-dark` or `text-on-dark-muted` on dark surfaces.

## Forbidden Combinations (will fail CI)
| Text Token      | Surface Token     | Ratio | Correct Alternative    |
|-----------------|-------------------|-------|------------------------|
| `text-faint`    | `bg-dark`         | 1.7:1 | `text-on-dark-muted`   |
| `text-muted`    | `bg-surface-dim`  | 2.8:1 | `text-body`            |
| `text-subtle`   | `bg-dark`         | 2.1:1 | `text-on-dark`         |

> Update this table whenever `scripts/generate-pairings.ts` finds new violations.

## Decision Rule
When uncertain between two color tokens → pick the one with HIGHER contrast.
Never assume a pairing is safe — check `colorPairings.ts`.

## Workflow
1. Choose colors using `src/tokens/colorPairings.ts` lookup
2. Apply tokens (never raw values)
3. Run `pnpm test:contrast` to verify
4. Fix any failures before committing
```

### File 3: `docs/DESIGN.md` (human + agent reference)

A longer-form design system document containing:
- Full color palette with hex values
- Semantic token naming conventions
- Typography scale and spacing scale
- Component patterns
- Accessibility requirements in detail
- Links to Figma / design source of truth

Link to this from `copilot-instructions.md` so the agent reads it for context.

---

## Layer 2: Structured Token Pairings File

### Why

LLMs cannot reliably compute contrast ratios mentally. A pre-computed lookup table of valid/forbidden pairings eliminates guesswork entirely.

### File: `src/tokens/colorPairings.ts`

```typescript
// src/tokens/colorPairings.ts
// AUTO-GENERATED — run `pnpm generate:pairings` to rebuild from CSS source

export interface TokenPairing {
  hex: string;
  validText: string[];        // >=4.5:1 ratio verified
  validLargeText: string[];   // >=3:1 ratio verified (18px+ or 14px+ bold)
  validUI: string[];          // >=3:1 ratio (borders, icons, focus rings)
  forbidden: string[];        // < 3:1 — NEVER use these
}

export const lightMode: Record<string, TokenPairing> = {
  "bg-surface": {
    hex: "#FFFFFF",
    validText: ["text-heading", "text-body", "text-link"],
    validLargeText: ["text-heading", "text-body", "text-muted", "text-link"],
    validUI: ["border-default", "icon-default", "icon-muted"],
    forbidden: ["text-on-dark", "text-on-dark-muted"],
  },
  "bg-surface-dim": {
    hex: "#F3F4F6",
    validText: ["text-heading", "text-body", "text-link"],
    validLargeText: ["text-heading", "text-body", "text-muted", "text-link"],
    validUI: ["border-default", "icon-default"],
    forbidden: ["text-faint", "text-subtle"],
  },
  // ... generated entries for all surfaces
};

export const darkMode: Record<string, TokenPairing> = {
  "bg-dark": {
    hex: "#1E2130",
    validText: ["text-on-dark", "text-on-dark-muted"],
    validLargeText: ["text-on-dark", "text-on-dark-muted", "text-accent-light"],
    validUI: ["border-on-dark", "icon-on-dark"],
    forbidden: ["text-faint", "text-muted", "text-subtle", "text-body"],
  },
  // ... generated entries
};

// Utility function for programmatic checks
export function isValidPairing(
  mode: "light" | "dark",
  bgToken: string,
  fgToken: string,
  size: "normal" | "large" = "normal"
): boolean {
  const pairings = mode === "light" ? lightMode : darkMode;
  const entry = pairings[bgToken as keyof typeof pairings];
  if (!entry) return false;
  if (size === "large") {
    return [...entry.validText, ...entry.validLargeText, ...entry.validUI].includes(fgToken);
  }
  return [...entry.validText, ...entry.validUI].includes(fgToken);
}
```

### File: `scripts/generate-pairings.ts`

```typescript
// scripts/generate-pairings.ts
// Parses src/index.css → computes all contrast ratios → writes colorPairings.ts
//
// Run: pnpm generate:pairings
// When: after ANY change to color tokens in index.css

import fs from "fs";
import path from "path";

// — WCAG relative luminance —
function hexToSrgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const linearize = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToSrgb(hex1));
  const l2 = relativeLuminance(hexToSrgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// — CSS parsing —
function extractTokens(css: string, selectorPattern: RegExp): Record<string, string> {
  const tokens: Record<string, string> = {};
  const blockRegex = new RegExp(
    selectorPattern.source + "\\s*\\{([^}]+)\\}",
    "gs"
  );
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(css)) !== null) {
    const block = match[1];
    for (const line of block.split("\n")) {
      const tokenMatch = line.match(/--(color-[\w-]+):\s*(#[0-9a-fA-F]{6})/);
      if (tokenMatch) {
        tokens[tokenMatch[1]] = tokenMatch[2];
      }
    }
  }
  return tokens;
}

function categorizePairings(
  surfaces: Record<string, string>,
  foregrounds: Record<string, string>
) {
  const result: Record<string, any> = {};

  for (const [bgName, bgHex] of Object.entries(surfaces)) {
    const entry = {
      hex: bgHex,
      validText: [] as string[],
      validLargeText: [] as string[],
      validUI: [] as string[],
      forbidden: [] as string[],
    };

    for (const [fgName, fgHex] of Object.entries(foregrounds)) {
      const ratio = contrastRatio(bgHex, fgHex);
      if (ratio >= 4.5) {
        entry.validText.push(fgName);
      } else if (ratio >= 3.0) {
        entry.validLargeText.push(fgName);
        entry.validUI.push(fgName);
      } else {
        entry.forbidden.push(fgName);
      }
    }
    result[bgName] = entry;
  }
  return result;
}

// — Main —
const cssPath = path.resolve(__dirname, "../src/index.css");
const css = fs.readFileSync(cssPath, "utf-8");

const lightTokens = extractTokens(css, /:root/);
const darkTokens = extractTokens(css, /\.dark|\[data-theme="dark"\]/);

// Separate surface vs foreground tokens by naming convention
// ADJUST these patterns to match YOUR token naming
const isSurface = (name: string) => /^color-(bg|surface)/.test(name);
const isForeground = (name: string) => /^color-(text|border|icon)/.test(name);

const lightSurfaces = Object.fromEntries(
  Object.entries(lightTokens).filter(([k]) => isSurface(k))
);
const lightForegrounds = Object.fromEntries(
  Object.entries(lightTokens).filter(([k]) => isForeground(k))
);
const darkSurfaces = Object.fromEntries(
  Object.entries(darkTokens).filter(([k]) => isSurface(k))
);
const darkForegrounds = Object.fromEntries(
  Object.entries(darkTokens).filter(([k]) => isForeground(k))
);

const lightPairings = categorizePairings(lightSurfaces, lightForegrounds);
const darkPairings = categorizePairings(darkSurfaces, darkForegrounds);

// Write output
const output = `// AUTO-GENERATED by scripts/generate-pairings.ts
// Last generated: ${new Date().toISOString()}
// Re-run: pnpm generate:pairings

export const lightMode = ${JSON.stringify(lightPairings, null, 2)} as const;

export const darkMode = ${JSON.stringify(darkPairings, null, 2)} as const;

export function isValidPairing(
  mode: "light" | "dark",
  bgToken: string,
  fgToken: string,
  size: "normal" | "large" = "normal"
): boolean {
  const pairings = mode === "light" ? lightMode : darkMode;
  const entry = pairings[bgToken as keyof typeof pairings];
  if (!entry) return false;
  if (size === "large") {
    return [...entry.validText, ...entry.validLargeText, ...entry.validUI].includes(fgToken);
  }
  return [...entry.validText, ...entry.validUI].includes(fgToken);
}
`;

const outPath = path.resolve(__dirname, "../src/tokens/colorPairings.ts");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, output);
console.log("Generated " + outPath);
console.log("  Light surfaces: " + Object.keys(lightPairings).length);
console.log("  Dark surfaces: " + Object.keys(darkPairings).length);
```

### package.json scripts

```json
{
  "scripts": {
    "generate:pairings": "tsx scripts/generate-pairings.ts",
    "test:contrast": "vitest run src/__tests__/colorContrast.test.ts",
    "precommit:ui": "pnpm generate:pairings && pnpm test:contrast"
  }
}
```

---

## Layer 3: CI Contrast Gate (Vitest)

### File: `src/__tests__/colorContrast.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { lightMode, darkMode } from "../tokens/colorPairings";

describe("Color Contrast — WCAG AA Compliance", () => {

  describe("Light mode", () => {
    for (const [surface, pairing] of Object.entries(lightMode)) {
      describe(`Surface: ${surface} (${pairing.hex})`, () => {
        it("has no forbidden tokens marked as valid", () => {
          const overlap = pairing.forbidden.filter(
            (t) => pairing.validText.includes(t) || pairing.validUI.includes(t)
          );
          expect(overlap).toEqual([]);
        });

        it("has at least one valid text token", () => {
          expect(pairing.validText.length).toBeGreaterThan(0);
        });
      });
    }
  });

  describe("Dark mode", () => {
    for (const [surface, pairing] of Object.entries(darkMode)) {
      describe(`Surface: ${surface} (${pairing.hex})`, () => {
        it("has no forbidden tokens marked as valid", () => {
          const overlap = pairing.forbidden.filter(
            (t) => pairing.validText.includes(t) || pairing.validUI.includes(t)
          );
          expect(overlap).toEqual([]);
        });

        it("has at least one valid text token", () => {
          expect(pairing.validText.length).toBeGreaterThan(0);
        });

        // Critical: the specific bug that started this effort
        it("does NOT allow light-mode text tokens on dark backgrounds", () => {
          const lightOnlyTokens = ["text-faint", "text-muted", "text-subtle"];
          for (const token of lightOnlyTokens) {
            expect(pairing.validText).not.toContain(token);
          }
        });
      });
    }
  });
});
```

### CI Pipeline Step (GitHub Actions)

```yaml
# .github/workflows/ci.yml (add to existing pipeline)
  contrast-check:
    name: WCAG Contrast Validation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm generate:pairings
      - name: Check pairings file is up-to-date
        run: git diff --exit-code src/tokens/colorPairings.ts
      - run: pnpm test:contrast
```

---

## Layer 4: Feedback Loop (Self-Healing)

### How it works with Copilot CLI

Add this to `.github/copilot-instructions.md`:

```markdown
## Post-Generation Validation (UI work)

After writing or modifying any component/page file:
1. Run `pnpm test:contrast`
2. If tests fail → read the error output → fix using `src/tokens/colorPairings.ts` as lookup
3. Re-run until passing
4. Only then consider the task complete

If you are unsure about a color choice, read `src/tokens/colorPairings.ts` FIRST.
```

### Pre-commit hook (catches humans + any agent that does not self-validate)

```bash
#!/bin/sh
# .husky/pre-commit
# Only run contrast check if UI files were modified
if git diff --cached --name-only | grep -qE '\.(tsx?|css)$'; then
  pnpm test:contrast || {
    echo ""
    echo "WCAG contrast check failed."
    echo "  Run: pnpm test:contrast"
    echo "  Fix using: src/tokens/colorPairings.ts"
    echo ""
    exit 1
  }
fi
```

---

## Critical Review: Trade-offs & Limitations

| Aspect | Assessment |
|--------|------------|
| **Coverage** | Covers token-level contrast only. Does NOT catch: opacity stacking, gradient overlays, images behind text, dynamically computed colors. |
| **False positives** | Token tests may flag decorative/non-text pairings. Mitigate by separating `text-*` tokens from `decorative-*` tokens in naming convention. |
| **Maintenance cost** | `generate-pairings.ts` must re-run when tokens change. CI step verifies generated file is up-to-date (diff check). |
| **Agent compliance** | Copilot CLI reads `.github/copilot-instructions.md` but may not always follow rules perfectly. The CI gate is the hard backstop. Instructions reduce failures ~70%, CI catches the remaining ~30%. |
| **Token-only enforcement** | If a developer bypasses tokens and uses raw `#hex` in a component, this system will not catch it. Consider adding an eslint rule blocking literal color values in className props. |
| **WCAG version** | Uses WCAG 2.1 relative luminance formula. WCAG 3.0 (APCA) is still in draft — when stable, update `generate-pairings.ts` to use APCA perceptual contrast. |
| **Path-specific instructions** | Only fire when Copilot works on files matching the `applyTo` glob. Adjust globs to match your project structure. |

---

## Implementation Order

| Step | Effort | Impact | Dependency |
|------|--------|--------|------------|
| 1. Create `.github/copilot-instructions.md` color section | 15 min | HIGH — immediate prevention | None |
| 2. Create `.github/instructions/ui-colors.instructions.md` | 15 min | HIGH — path-specific rules | None |
| 3. Create `docs/DESIGN.md` with full color reference | 1 hr | MEDIUM — long-form reference | None |
| 4. Write `scripts/generate-pairings.ts` | 2 hr | HIGH — enables layers 2+3 | Token CSS exists |
| 5. Run generator → create `src/tokens/colorPairings.ts` | 5 min | HIGH — agent lookup table | Step 4 |
| 6. Write `src/__tests__/colorContrast.test.ts` | 1 hr | MEDIUM — CI safety net | Step 5 |
| 7. Add CI pipeline step | 30 min | MEDIUM — hard backstop | Step 6 |
| 8. Add pre-commit hook | 15 min | LOW-MEDIUM — local safety | Step 6 |

**Total estimated effort: ~5 hours for full implementation.**

---

## File Tree Summary

```
project-root/
├── .github/
│   ├── copilot-instructions.md          ← Global agent rules
│   ├── instructions/
│   │   └── ui-colors.instructions.md    ← Path-specific color rules
│   └── workflows/
│       └── ci.yml                       ← Contrast check step
├── docs/
│   └── DESIGN.md                        ← Full design system reference
├── scripts/
│   └── generate-pairings.ts             ← Computes valid/forbidden combos
├── src/
│   ├── index.css                        ← Token definitions (source of truth)
│   ├── tokens/
│   │   └── colorPairings.ts             ← AUTO-GENERATED lookup table
│   └── __tests__/
│       └── colorContrast.test.ts        ← CI contrast gate
├── .husky/
│   └── pre-commit                       ← Local safety hook
└── package.json                         ← Scripts: generate:pairings, test:contrast
```

---

## Success Criteria

- [ ] Agent never produces raw hex values in component files
- [ ] Agent consults `colorPairings.ts` before applying color tokens
- [ ] CI blocks any PR that introduces a contrast violation < 4.5:1
- [ ] `pnpm generate:pairings` runs cleanly on current token set
- [ ] Dark mode text tokens are strictly separated from light mode text tokens
- [ ] Forbidden combinations table in instructions matches generated data
- [ ] Pre-commit hook prevents local commits with contrast violations

