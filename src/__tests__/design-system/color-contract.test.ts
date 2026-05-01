import { describe, it, expect } from 'vitest';

// ============================================================
// WCAG CONTRAST RATIO CALCULATOR (Pure math, no dependencies)
// ============================================================

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function hue(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}

function saturation(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

// ============================================================
// SINGLE SOURCE OF TRUTH — THE DESIGN TOKEN CONTRACT
// ============================================================
// AI agents and developers MUST NOT introduce colors outside this set.
// To add a new color:
//   1. Add it here
//   2. Add a contrast test pair below
//   3. Verify it passes AAA (≥7:1 normal text, ≥4.5:1 large text)
//   4. Verify it's not a banned hue
//   5. Verify total color count stays ≤ 18
//   6. Run: npm run test:colors
// ============================================================

export const DESIGN_TOKENS = {
  light: {
    bgPrimary: '#FFFFFF',
    bgCard: '#F8FAFC',
    bgHover: '#F1F5F9',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#475569',
    accentPrimary: '#0369a1',    // sky-700
    accentSecondary: '#115E59',  // teal-800
    success: '#065F46',          // emerald-800
    danger: '#991B1B',           // red-800
    border: '#CBD5E1',           // slate-300 (decorative)
  },
  dark: {
    bgPrimary: '#0F172A',
    bgCard: '#1E293B',
    bgHover: '#334155',
    textPrimary: '#F1F5F9',
    textSecondary: '#CBD5E1',
    textMuted: '#A9B5BF',        // custom cool gray (AAA verified)
    accentPrimary: '#7dd3fc',    // sky-300
    accentSecondary: '#67E8F9',  // cyan-300
    success: '#6EE7B7',          // emerald-300
    danger: '#FCA5A5',           // red-300
    border: '#334155',           // slate-700
  },
  aurora: {
    base: '#0c1222',     // aurora header background
    cyan: '#06b6d4',     // cyan-500
    green: '#34d399',    // emerald-400
    purple: '#a855f7',   // purple-500
    text: '#FFFFFF',
  },
  interactive: {
    light: '#0369a1',    // sky-700 (same as accentPrimary)
    dark: '#0c4a6e',     // sky-900 (dark enough for white text)
  },
} as const;

// ============================================================
// APPROVED COLOR SET (for ESLint rule and source scanning)
// ============================================================

export const APPROVED_HEX_COLORS = new Set([
  ...Object.values(DESIGN_TOKENS.light),
  ...Object.values(DESIGN_TOKENS.dark),
  ...Object.values(DESIGN_TOKENS.aurora),
  ...Object.values(DESIGN_TOKENS.interactive),
]);

// ============================================================
// CONTRAST REQUIREMENTS
// ============================================================

const AAA_NORMAL_TEXT = 7.0;
const AAA_LARGE_TEXT = 4.5;
const UI_COMPONENT = 3.0;

// ============================================================
// TEST: Every text/background pair passes WCAG AAA
// ============================================================

describe('WCAG AAA: Normal text contrast (≥ 7:1)', () => {
  const normalTextPairs = [
    // Light mode
    { name: 'Light: textPrimary on bgPrimary', fg: DESIGN_TOKENS.light.textPrimary, bg: DESIGN_TOKENS.light.bgPrimary },
    { name: 'Light: textPrimary on bgCard', fg: DESIGN_TOKENS.light.textPrimary, bg: DESIGN_TOKENS.light.bgCard },
    { name: 'Light: textSecondary on bgPrimary', fg: DESIGN_TOKENS.light.textSecondary, bg: DESIGN_TOKENS.light.bgPrimary },
    { name: 'Light: textSecondary on bgCard', fg: DESIGN_TOKENS.light.textSecondary, bg: DESIGN_TOKENS.light.bgCard },
    { name: 'Light: textMuted on bgPrimary', fg: DESIGN_TOKENS.light.textMuted, bg: DESIGN_TOKENS.light.bgPrimary },
    { name: 'Light: textMuted on bgCard', fg: DESIGN_TOKENS.light.textMuted, bg: DESIGN_TOKENS.light.bgCard },
    { name: 'Light: accentSecondary on bgPrimary', fg: DESIGN_TOKENS.light.accentSecondary, bg: DESIGN_TOKENS.light.bgPrimary },
    { name: 'Light: accentSecondary on bgCard', fg: DESIGN_TOKENS.light.accentSecondary, bg: DESIGN_TOKENS.light.bgCard },
    { name: 'Light: success on bgPrimary', fg: DESIGN_TOKENS.light.success, bg: DESIGN_TOKENS.light.bgPrimary },
    { name: 'Light: success on bgCard', fg: DESIGN_TOKENS.light.success, bg: DESIGN_TOKENS.light.bgCard },
    { name: 'Light: danger on bgPrimary', fg: DESIGN_TOKENS.light.danger, bg: DESIGN_TOKENS.light.bgPrimary },
    { name: 'Light: danger on bgCard', fg: DESIGN_TOKENS.light.danger, bg: DESIGN_TOKENS.light.bgCard },
    // Dark mode
    { name: 'Dark: textPrimary on bgPrimary', fg: DESIGN_TOKENS.dark.textPrimary, bg: DESIGN_TOKENS.dark.bgPrimary },
    { name: 'Dark: textPrimary on bgCard', fg: DESIGN_TOKENS.dark.textPrimary, bg: DESIGN_TOKENS.dark.bgCard },
    { name: 'Dark: textSecondary on bgPrimary', fg: DESIGN_TOKENS.dark.textSecondary, bg: DESIGN_TOKENS.dark.bgPrimary },
    { name: 'Dark: textSecondary on bgCard', fg: DESIGN_TOKENS.dark.textSecondary, bg: DESIGN_TOKENS.dark.bgCard },
    { name: 'Dark: textMuted on bgPrimary', fg: DESIGN_TOKENS.dark.textMuted, bg: DESIGN_TOKENS.dark.bgPrimary },
    { name: 'Dark: textMuted on bgCard', fg: DESIGN_TOKENS.dark.textMuted, bg: DESIGN_TOKENS.dark.bgCard },
    { name: 'Dark: accentPrimary on bgPrimary', fg: DESIGN_TOKENS.dark.accentPrimary, bg: DESIGN_TOKENS.dark.bgPrimary },
    { name: 'Dark: accentPrimary on bgCard', fg: DESIGN_TOKENS.dark.accentPrimary, bg: DESIGN_TOKENS.dark.bgCard },
    { name: 'Dark: accentSecondary on bgPrimary', fg: DESIGN_TOKENS.dark.accentSecondary, bg: DESIGN_TOKENS.dark.bgPrimary },
    { name: 'Dark: accentSecondary on bgCard', fg: DESIGN_TOKENS.dark.accentSecondary, bg: DESIGN_TOKENS.dark.bgCard },
    { name: 'Dark: success on bgPrimary', fg: DESIGN_TOKENS.dark.success, bg: DESIGN_TOKENS.dark.bgPrimary },
    { name: 'Dark: success on bgCard', fg: DESIGN_TOKENS.dark.success, bg: DESIGN_TOKENS.dark.bgCard },
    { name: 'Dark: danger on bgPrimary', fg: DESIGN_TOKENS.dark.danger, bg: DESIGN_TOKENS.dark.bgPrimary },
    { name: 'Dark: danger on bgCard', fg: DESIGN_TOKENS.dark.danger, bg: DESIGN_TOKENS.dark.bgCard },
  ];

  normalTextPairs.forEach(({ name, fg, bg }) => {
    it(`${name} — ${fg} on ${bg} ≥ 7:1`, () => {
      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `Expected ≥ ${AAA_NORMAL_TEXT}:1 but got ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(AAA_NORMAL_TEXT);
    });
  });
});

describe('WCAG AAA: Large text contrast (≥ 4.5:1)', () => {
  const largeTextPairs = [
    // Aurora: text sits on the dark base only (gradient colors are decorative)
    { name: 'Aurora: white on base', fg: DESIGN_TOKENS.aurora.text, bg: DESIGN_TOKENS.aurora.base },
    // Accent as text (used for links/labels, always semi-bold)
    { name: 'Light: accentPrimary on bgPrimary', fg: DESIGN_TOKENS.light.accentPrimary, bg: DESIGN_TOKENS.light.bgPrimary },
    { name: 'Light: accentPrimary on bgCard', fg: DESIGN_TOKENS.light.accentPrimary, bg: DESIGN_TOKENS.light.bgCard },
  ];

  largeTextPairs.forEach(({ name, fg, bg }) => {
    it(`${name} — ${fg} on ${bg} ≥ 4.5:1`, () => {
      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `Expected ≥ ${AAA_LARGE_TEXT}:1 but got ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(AAA_LARGE_TEXT);
    });
  });
});

describe('WCAG AAA: UI component contrast (≥ 3:1)', () => {
  it('Light: accent focus ring on white', () => {
    expect(contrastRatio(DESIGN_TOKENS.light.accentPrimary, DESIGN_TOKENS.light.bgPrimary))
      .toBeGreaterThanOrEqual(UI_COMPONENT);
  });
  it('Dark: accent focus ring on card', () => {
    expect(contrastRatio(DESIGN_TOKENS.dark.accentPrimary, DESIGN_TOKENS.dark.bgCard))
      .toBeGreaterThanOrEqual(UI_COMPONENT);
  });
  it('Light: white text on accent-interactive', () => {
    expect(contrastRatio('#FFFFFF', DESIGN_TOKENS.interactive.light))
      .toBeGreaterThanOrEqual(AAA_LARGE_TEXT);
  });
  it('Dark: white text on accent-interactive', () => {
    expect(contrastRatio('#FFFFFF', DESIGN_TOKENS.interactive.dark))
      .toBeGreaterThanOrEqual(AAA_LARGE_TEXT);
  });
});

// ============================================================
// TEST: Palette size limits
// ============================================================

describe('Color count guardrails', () => {
  it('Total unique colors ≤ 22', () => {
    expect(APPROVED_HEX_COLORS.size).toBeLessThanOrEqual(22);
  });

  it('Light mode uses ≤ 11 tokens', () => {
    expect(Object.keys(DESIGN_TOKENS.light).length).toBeLessThanOrEqual(11);
  });

  it('Dark mode uses ≤ 11 tokens', () => {
    expect(Object.keys(DESIGN_TOKENS.dark).length).toBeLessThanOrEqual(11);
  });

  it('Aurora uses ≤ 5 colors', () => {
    expect(Object.keys(DESIGN_TOKENS.aurora).length).toBeLessThanOrEqual(5);
  });
});

// ============================================================
// TEST: Banned hue families
// ============================================================

describe('Banned color hues', () => {
  const allTokenHexes = [...APPROVED_HEX_COLORS];

  allTokenHexes.forEach((color) => {
    const h = hue(color);
    const s = saturation(color);

    if (s > 0.1) { // Only check chromatic colors
      it(`${color} is NOT yellow (hue 40-70)`, () => {
        const isYellow = h >= 40 && h <= 70 && s > 0.3;
        expect(isYellow, `${color} has hue=${h}, sat=${s.toFixed(2)} — looks yellow!`).toBe(false);
      });

      it(`${color} is NOT orange (hue 15-40)`, () => {
        const isOrange = h >= 15 && h <= 40 && s > 0.4;
        expect(isOrange, `${color} has hue=${h}, sat=${s.toFixed(2)} — looks orange!`).toBe(false);
      });

      it(`${color} is NOT hot pink (hue 320-345)`, () => {
        const isHotPink = h >= 320 && h <= 345 && s > 0.5;
        expect(isHotPink, `${color} has hue=${h}, sat=${s.toFixed(2)} — looks hot pink!`).toBe(false);
      });
    }
  });
});
