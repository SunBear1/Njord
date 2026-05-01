import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { APPROVED_HEX_COLORS } from './color-contract.test';

// ============================================================
// APPROVED CHART PALETTE (subset of design tokens)
// ============================================================

export const CHART_PALETTE = {
  light: {
    primary: '#0369a1',     // sky-700
    secondary: '#115E59',   // teal
    positive: '#065F46',    // emerald
    negative: '#991B1B',    // red
    neutral: '#475569',     // slate
    band: '#F1F5F9',        // very light — confidence intervals
  },
  dark: {
    primary: '#38bdf8',     // sky-400
    secondary: '#67E8F9',   // cyan
    positive: '#6EE7B7',    // emerald
    negative: '#FCA5A5',    // red
    neutral: '#A9B5BF',     // gray
    band: '#334155',        // dark — confidence intervals
  },
} as const;

describe('Chart colors are within design system', () => {
  const allChartColors = [
    ...Object.values(CHART_PALETTE.light),
    ...Object.values(CHART_PALETTE.dark),
  ];

  allChartColors.forEach((color) => {
    it(`Chart color ${color} is in APPROVED_HEX_COLORS`, () => {
      expect(
        APPROVED_HEX_COLORS.has(color),
        `${color} is used in charts but NOT in DESIGN_TOKENS. Add it or use an approved color.`
      ).toBe(true);
    });
  });

  it('Max 6 distinct chart colors per theme', () => {
    expect(Object.keys(CHART_PALETTE.light).length).toBeLessThanOrEqual(6);
    expect(Object.keys(CHART_PALETTE.dark).length).toBeLessThanOrEqual(6);
  });
});

describe('Chart files only use CHART_PALETTE', () => {
  function findChartFiles(dir: string, files: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory() && !['node_modules', 'dist'].includes(entry)) {
        findChartFiles(fullPath, files);
      } else if (/[Cc]hart.*\.(tsx?|jsx?)$/.test(entry)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const chartFiles = findChartFiles(join(process.cwd(), 'src'));

  chartFiles.forEach((file) => {
    it(`${file.replace(process.cwd() + '/', '')}: colors are from CHART_PALETTE`, () => {
      const content = readFileSync(file, 'utf-8');
      const hexInFile = content.match(/#[0-9a-fA-F]{6}\b/g) || [];
      const invalidColors = hexInFile.filter(
        (hex) => !APPROVED_HEX_COLORS.has(hex) && !APPROVED_HEX_COLORS.has(hex.toUpperCase())
      );

      expect(
        invalidColors,
        `Chart file uses non-approved colors: ${invalidColors.join(', ')}`
      ).toHaveLength(0);
    });
  });
});
