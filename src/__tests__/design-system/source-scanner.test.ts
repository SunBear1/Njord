import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { APPROVED_HEX_COLORS } from './color-contract.test';

// ============================================================
// UTILITY: Recursively find all source files
// ============================================================

function findSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      if (!['node_modules', 'dist', '.git', 'coverage', '__tests__'].includes(entry)) {
        findSourceFiles(fullPath, files);
      }
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Lowercase normalized set for case-insensitive comparison
const APPROVED_LOWER = new Set(
  [...APPROVED_HEX_COLORS].map((c) => c.toLowerCase())
);

// ============================================================
// TEST: No unauthorized hex colors in source files
// ============================================================

describe('Source code color guardrails', () => {
  const srcDir = join(process.cwd(), 'src');
  const files = findSourceFiles(srcDir);

  it('found source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  files.forEach((file) => {
    const relativePath = file.replace(process.cwd() + '/', '');

    it(`${relativePath}: no unauthorized hex colors`, () => {
      const content = readFileSync(file, 'utf-8');
      const hexMatches = content.match(/#[0-9a-fA-F]{6}\b/g) || [];
      const unauthorized = hexMatches.filter(
        (hex) => !APPROVED_LOWER.has(hex.toLowerCase())
      );

      expect(
        unauthorized,
        `Unauthorized colors: ${[...new Set(unauthorized)].join(', ')}\n` +
        `Only DESIGN_TOKENS colors are allowed.\n` +
        `To add a color: update DESIGN_TOKENS in color-contract.test.ts and verify AAA.`
      ).toHaveLength(0);
    });

    it(`${relativePath}: no arbitrary Tailwind color values`, () => {
      const content = readFileSync(file, 'utf-8');
      const arbitrary = content.match(
        /(bg|text|border|ring|outline|shadow|fill|stroke|from|via|to)-\[#[0-9a-fA-F]{3,8}\]/g
      ) || [];

      expect(
        arbitrary,
        `Arbitrary Tailwind colors: ${arbitrary.join(', ')}\n` +
        `Use semantic classes (e.g., text-accent-primary) instead.`
      ).toHaveLength(0);
    });

    it(`${relativePath}: no inline style color properties`, () => {
      const content = readFileSync(file, 'utf-8');

      // Skip chart components (Recharts requires inline color props)
      if (relativePath.includes('chart') || relativePath.includes('Chart')) {
        return; // Charts get a pass — validated separately
      }

      const inlineColors = content.match(
        /style=\{\{[^}]*(color|backgroundColor|borderColor)\s*:/g
      ) || [];

      expect(
        inlineColors,
        `Inline color styles found. Use Tailwind classes.\n` +
        `Exception: Recharts components (must be in a *Chart* file).`
      ).toHaveLength(0);
    });
  });
});
