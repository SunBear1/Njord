#!/usr/bin/env node
/**
 * Test Report Generator
 *
 * Reads analysis JSON from test-quality.ts and generates a comprehensive
 * markdown report suitable for GitHub Actions GITHUB_STEP_SUMMARY.
 *
 * Usage: npx tsx scripts/generate-test-report.ts [input-file]
 */

import fs from 'fs';

interface ModuleCoverage {
  module: string;
  files: number;
  statements: number;
  functions: number;
  branches: number;
}

interface TestAnalysis {
  totalTests: number;
  totalTestFiles: number;
  passRate: number;
  coverage: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  byModule: ModuleCoverage[];
  gaps: {
    untestedFiles: string[];
    lowCoverageFiles: string[];
    routesCoveredByE2E: string[];
    routesMissingE2E: string[];
  };
  recommendations: string[];
  timestamp: string;
}

function badge(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  let icon = '🟢';
  if (percent < 50) icon = '🔴';
  else if (percent < 75) icon = '🟡';
  return `${icon} \`${bar}\` **${percent}%**`;
}

function generateReport(a: TestAnalysis): string {
  const lines: string[] = [];

  lines.push('# 📊 Test Quality Report');
  lines.push('');

  // --- Summary ---
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  if (a.totalTests > 0) {
    const passIcon = a.passRate === 100 ? '✅' : '❌';
    lines.push(`| **Tests** | ${passIcon} ${a.totalTests} (${a.passRate.toFixed(1)}% pass rate) |`);
  }
  lines.push(`| **Test Files** | ${a.totalTestFiles} |`);
  lines.push(`| **Statements** | ${a.coverage.statements}% |`);
  lines.push(`| **Functions** | ${a.coverage.functions}% |`);
  lines.push(`| **Branches** | ${a.coverage.branches}% |`);
  lines.push('');

  // --- Coverage by Module ---
  lines.push('## Coverage by Module');
  lines.push('');
  lines.push('> Coverage is instrumented for `src/utils/**` only (per vitest config).');
  lines.push('');
  lines.push('| Module | Files | Statements | Functions | Branches |');
  lines.push('|---|---|---|---|---|');
  for (const m of a.byModule) {
    lines.push(`| **${m.module}** | ${m.files} | ${badge(m.statements)} | ${badge(m.functions)} | ${badge(m.branches)} |`);
  }
  lines.push('');

  // --- Overall trend ---
  lines.push('## Overall Coverage');
  lines.push('');
  lines.push(`**Statements:** ${badge(a.coverage.statements)}`);
  lines.push(`**Functions:** ${badge(a.coverage.functions)}`);
  lines.push(`**Branches:** ${badge(a.coverage.branches)}`);
  lines.push('');

  // --- E2E Route Coverage ---
  lines.push('## E2E Route Coverage');
  lines.push('');
  if (a.gaps.routesCoveredByE2E.length > 0) {
    lines.push('**Covered:**');
    a.gaps.routesCoveredByE2E.forEach((r) => lines.push(`- ✅ \`${r}\``));
  }
  if (a.gaps.routesMissingE2E.length > 0) {
    lines.push('');
    lines.push('**Missing E2E:**');
    a.gaps.routesMissingE2E.forEach((r) => lines.push(`- ❌ \`${r}\``));
  }
  lines.push('');

  // --- Gaps ---
  if (a.gaps.untestedFiles.length > 0 || a.gaps.lowCoverageFiles.length > 0) {
    lines.push('## Coverage Gaps');
    lines.push('');
    if (a.gaps.untestedFiles.length > 0) {
      lines.push('<details>');
      lines.push(`<summary>🔴 Zero-coverage files (${a.gaps.untestedFiles.length})</summary>`);
      lines.push('');
      a.gaps.untestedFiles.forEach((f) => lines.push(`- \`${f}\``));
      lines.push('</details>');
      lines.push('');
    }
    if (a.gaps.lowCoverageFiles.length > 0) {
      lines.push('<details>');
      lines.push(`<summary>🟡 Low-coverage files (${a.gaps.lowCoverageFiles.length})</summary>`);
      lines.push('');
      a.gaps.lowCoverageFiles.forEach((f) => lines.push(`- ${f}`));
      lines.push('</details>');
      lines.push('');
    }
  }

  // --- Recommendations ---
  lines.push('## Recommendations');
  lines.push('');
  a.recommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  lines.push('');

  lines.push(`---`);
  lines.push(`*Generated: ${new Date(a.timestamp).toLocaleString('pl-PL')}*`);

  return lines.join('\n');
}

function main() {
  const inputFile = process.argv[2] ?? 'coverage/analysis.json';

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Analysis file not found: ${inputFile}`);
    console.error('Run: npm run test:coverage && npx tsx scripts/test-quality.ts');
    process.exit(1);
  }

  const analysis: TestAnalysis = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  const report = generateReport(analysis);

  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    fs.appendFileSync(summaryFile, report);
    console.log('✓ Report written to GITHUB_STEP_SUMMARY');
  } else {
    const localFile = 'test-quality-report.md';
    fs.writeFileSync(localFile, report);
    console.log(report);
    console.log(`\n✓ Report written to ${localFile}`);
  }
}

main();
