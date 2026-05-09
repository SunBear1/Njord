import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { APPROVED_HEX_COLORS } from './color-contract.test';

// ============================================================
// APPROVED CHART PALETTE (subset of design tokens)
// ============================================================

export const CHART_PALETTE = {
  light: {
    benchmark: '#2563eb',        // blue-600
    bear: '#991B1B',             // red-800
    base: '#115E59',             // teal-800 (reuse from accentSecondary)
    bull: '#065F46',             // emerald-800
    purchasingPower: '#475569',  // slate-600
  },
  dark: {
    benchmark: '#60a5fa',        // blue-400
    bear: '#FCA5A5',             // red-300
    base: '#67E8F9',             // cyan-300 (reuse from dark accentSecondary)
    bull: '#6EE7B7',             // emerald-300
    purchasingPower: '#A9B5BF',  // gray
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
