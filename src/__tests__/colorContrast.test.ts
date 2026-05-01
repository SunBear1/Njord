/**
 * WCAG color contrast validation tests.
 *
 * Parses src/index.css directly to extract light-mode (@theme) and dark-mode (html.dark)
 * token values, then asserts contrast ratios for readable text token + surface pairs.
 *
 * If a test fails, a color token was changed to a value that breaks accessibility.
 * Fix the token in src/index.css, then re-run: npm run generate:pairings
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// — WCAG 2.1 contrast math —

function hexToLinear(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const linearize = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return [linearize(r), linearize(g), linearize(b)];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// — CSS parsing —

function extractBlockContent(css: string, pattern: RegExp): string {
  const match = css.match(pattern);
  return match ? match[1] : '';
}

function extractTokenMap(blockContent: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const re = /--(color-[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blockContent)) !== null) {
    tokens[m[1]] = m[2].toUpperCase();
  }
  return tokens;
}

const cssPath = path.resolve(__dirname, '../../src/index.css');
const css = fs.readFileSync(cssPath, 'utf-8');

const themeBlock = extractBlockContent(css, /@theme\s*\{([\s\S]*?)\}/);
const darkBlock = extractBlockContent(css, /html\.dark\s*\{([\s\S]*?)\}/);

const lightTokens = extractTokenMap(themeBlock);
const darkTokens = { ...lightTokens, ...extractTokenMap(darkBlock) };

// Helper: get contrast with a descriptive error
function assertContrast(fg: string, bg: string, fgName: string, bgName: string, minRatio: number) {
  const ratio = contrastRatio(fg, bg);
  expect(
    ratio,
    `${fgName} (${fg}) on ${bgName} (${bg}): ${ratio.toFixed(2)}:1 — must be >= ${minRatio}:1`,
  ).toBeGreaterThanOrEqual(minRatio);
}

// — Test suites —

describe('Color Contrast — WCAG AA compliance', () => {
  describe('Light mode: readable text tokens on light surfaces', () => {
    // text-heading and text-body must meet WCAG AA (4.5:1) on all light surfaces
    const lightSurfaces: Array<[string, string]> = [
      ['surface', lightTokens['color-surface']],
      ['surface-alt', lightTokens['color-surface-alt']],
      ['surface-muted', lightTokens['color-surface-muted']],
    ];

    const primaryTextTokens: Array<[string, string]> = [
      ['heading', lightTokens['color-heading']],
      ['body', lightTokens['color-body']],
    ];

    for (const [surfaceName, surfaceHex] of lightSurfaces) {
      for (const [textName, textHex] of primaryTextTokens) {
        it(`text-${textName} on bg-${surfaceName} >= 4.5:1`, () => {
          assertContrast(textHex, surfaceHex, `text-${textName}`, `bg-${surfaceName}`, 4.5);
        });
      }
    }

    // text-muted is secondary/helper text — must pass 4.5:1 on the primary surface.
    // On secondary surfaces (surface-alt, surface-muted) large-text AA (3:1) is acceptable.
    it('text-muted on bg-surface >= 4.5:1 (primary surface)', () => {
      assertContrast(lightTokens['color-muted'], lightTokens['color-surface'], 'text-muted', 'bg-surface', 4.5);
    });

    it('text-muted on bg-surface-alt >= 3:1 (secondary surface — large text AA)', () => {
      assertContrast(lightTokens['color-muted'], lightTokens['color-surface-alt'], 'text-muted', 'bg-surface-alt', 3.0);
    });

    it('text-muted on bg-surface-muted >= 3:1 (secondary surface — large text AA)', () => {
      assertContrast(lightTokens['color-muted'], lightTokens['color-surface-muted'], 'text-muted', 'bg-surface-muted', 3.0);
    });
  });

  describe('Dark mode: readable text tokens on dark surfaces', () => {
    const darkSurfaces: Array<[string, string]> = [
      ['surface', darkTokens['color-surface']],
      ['surface-alt', darkTokens['color-surface-alt']],
      ['surface-muted', darkTokens['color-surface-muted']],
      ['surface-dark', darkTokens['color-surface-dark']],
      ['surface-dark-alt', darkTokens['color-surface-dark-alt']],
    ];

    const readableTextTokens: Array<[string, string]> = [
      ['heading', darkTokens['color-heading']],
      ['body', darkTokens['color-body']],
      ['on-dark', darkTokens['color-on-dark']],
      ['on-dark-muted', darkTokens['color-on-dark-muted']],
    ];

    for (const [surfaceName, surfaceHex] of darkSurfaces) {
      for (const [textName, textHex] of readableTextTokens) {
        it(`text-${textName} on bg-${surfaceName} >= 4.5:1`, () => {
          assertContrast(textHex, surfaceHex, `text-${textName}`, `bg-${surfaceName}`, 4.5);
        });
      }
    }

    it('text-muted on bg-surface >= 4.5:1', () => {
      assertContrast(darkTokens['color-muted'], darkTokens['color-surface'], 'text-muted', 'bg-surface', 4.5);
    });
  });

  describe('Dark mode: text-faint must NOT be readable text (decorative token only)', () => {
    // text-faint in dark mode (#4f5d75) is intentionally low contrast — it is a
    // decorative-only token (borders, disabled states, purely visual separators).
    // These tests document that using dark:text-faint on dark surfaces VIOLATES WCAG AA.
    // If these tests start passing (ratio >= 4.5), someone changed faint to a
    // high-contrast value — update the token's role or rename it.
    const darkSurfaces: Array<[string, string]> = [
      ['surface', darkTokens['color-surface']],
      ['surface-alt', darkTokens['color-surface-alt']],
      ['surface-dark', darkTokens['color-surface-dark']],
      ['surface-dark-alt', darkTokens['color-surface-dark-alt']],
    ];

    for (const [surfaceName, surfaceHex] of darkSurfaces) {
      it(`text-faint on bg-${surfaceName} is below 4.5:1 (decorative only — do NOT use for readable text)`, () => {
        const ratio = contrastRatio(darkTokens['color-faint'], surfaceHex);
        expect(
          ratio,
          `text-faint (${darkTokens['color-faint']}) on bg-${surfaceName} (${surfaceHex}): ${ratio.toFixed(2)}:1 — if this token now passes 4.5:1, update its role in src/index.css comments and colorPairings.ts`,
        ).toBeLessThan(4.5);
      });
    }
  });

  describe('Light mode: on-dark tokens must NOT be used on light surfaces', () => {
    // text-on-dark / text-on-dark-muted are white/near-white — invisible on light backgrounds
    const lightSurfaces: Array<[string, string]> = [
      ['surface', lightTokens['color-surface']],
      ['surface-alt', lightTokens['color-surface-alt']],
    ];

    for (const [surfaceName, surfaceHex] of lightSurfaces) {
      it(`text-on-dark-muted on bg-${surfaceName} is below 4.5:1 (light-mode only surfaces)`, () => {
        const ratio = contrastRatio(lightTokens['color-on-dark-muted'], surfaceHex);
        expect(ratio).toBeLessThan(4.5);
      });
    }
  });
});
