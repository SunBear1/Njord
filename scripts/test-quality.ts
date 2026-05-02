#!/usr/bin/env node
/**
 * Test Quality Analysis Script
 *
 * Reads coverage-final.json (produced by `npm run test:coverage`) and
 * vitest JSON reporter output to generate test quality metrics.
 *
 * Does NOT re-run tests — must be called after `npm run test:coverage`.
 *
 * Usage: npx tsx scripts/test-quality.ts [output-file]
 * Example: npx tsx scripts/test-quality.ts coverage/analysis.json
 */

import fs from 'fs';
import path from 'path';

interface FileCoverageData {
  path: string;
  s: Record<string, number>;
  f: Record<string, number>;
  b: Record<string, number[]>;
  fnMap: Record<string, unknown>;
  statementMap: Record<string, unknown>;
  branchMap: Record<string, unknown>;
}

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

function pct(hit: number, total: number): number {
  return total === 0 ? 100 : Math.round((hit / total) * 100);
}

/**
 * Parse coverage-final.json (v8/Istanbul format) for real coverage numbers.
 */
function parseCoverageFinal(coverageFile: string): {
  global: { statements: number; functions: number; branches: number };
  byFile: Map<string, { statements: number; functions: number; branches: number }>;
} {
  if (!fs.existsSync(coverageFile)) {
    throw new Error(
      `Coverage file not found: ${coverageFile}\nRun 'npm run test:coverage' first.`,
    );
  }

  const raw: Record<string, FileCoverageData> = JSON.parse(fs.readFileSync(coverageFile, 'utf-8'));

  let sHit = 0, sTotal = 0;
  let fHit = 0, fTotal = 0;
  let bHit = 0, bTotal = 0;

  const byFile = new Map<string, { statements: number; functions: number; branches: number }>();

  for (const [, data] of Object.entries(raw)) {
    const filePath = data.path;
    const sVals = Object.values(data.s);
    const fVals = Object.values(data.f);
    const bVals = (Object.values(data.b) as number[][]).flat();

    const fileSHit = sVals.filter((v) => v > 0).length;
    const fileFHit = fVals.filter((v) => v > 0).length;
    const fileBHit = bVals.filter((v) => v > 0).length;

    sHit += fileSHit; sTotal += sVals.length;
    fHit += fileFHit; fTotal += fVals.length;
    bHit += fileBHit; bTotal += bVals.length;

    byFile.set(filePath, {
      statements: pct(fileSHit, sVals.length),
      functions: pct(fileFHit, fVals.length),
      branches: pct(fileBHit, bVals.length),
    });
  }

  return {
    global: {
      statements: pct(sHit, sTotal),
      functions: pct(fHit, fTotal),
      branches: pct(bHit, bTotal),
    },
    byFile,
  };
}

/**
 * Parse vitest JSON reporter output for test counts.
 * Produces test counts without re-running tests.
 */
function parseTestResultsJson(testResultsFile: string): { total: number; passed: number; passRate: number } {
  if (!fs.existsSync(testResultsFile)) {
    // No JSON file — return 0s; workflow step will have logged the real result
    return { total: 0, passed: 0, passRate: 0 };
  }

  interface VitestJsonResult {
    numTotalTests: number;
    numPassedTests: number;
    numFailedTests: number;
    testResults?: Array<{ numPassingTests: number; numFailingTests: number }>;
  }

  const raw: VitestJsonResult = JSON.parse(fs.readFileSync(testResultsFile, 'utf-8'));

  const total = raw.numTotalTests ?? 0;
  const passed = raw.numPassedTests ?? 0;

  return {
    total,
    passed,
    passRate: total > 0 ? (passed / total) * 100 : 0,
  };
}

/**
 * Aggregate per-file coverage into module buckets.
 */
function aggregateByModule(
  byFile: Map<string, { statements: number; functions: number; branches: number }>,
  cwd: string,
): ModuleCoverage[] {
  const buckets: Record<string, { stmtSum: number; fnSum: number; brSum: number; count: number }> = {};

  for (const [absPath, cov] of byFile.entries()) {
    const rel = path.relative(path.join(cwd, 'src'), absPath);
    const module = rel.split(path.sep)[0] ?? 'other';

    if (!buckets[module]) {
      buckets[module] = { stmtSum: 0, fnSum: 0, brSum: 0, count: 0 };
    }
    buckets[module].stmtSum += cov.statements;
    buckets[module].fnSum += cov.functions;
    buckets[module].brSum += cov.branches;
    buckets[module].count += 1;
  }

  return Object.entries(buckets)
    .map(([module, b]) => ({
      module,
      files: b.count,
      statements: Math.round(b.stmtSum / b.count),
      functions: Math.round(b.fnSum / b.count),
      branches: Math.round(b.brSum / b.count),
    }))
    .sort((a, b) => a.statements - b.statements); // lowest first — most actionable
}

/**
 * Identify files with zero coverage (untested) and low coverage.
 */
function findCoverageGaps(
  byFile: Map<string, { statements: number; functions: number; branches: number }>,
  cwd: string,
): { untestedFiles: string[]; lowCoverageFiles: string[] } {
  const untestedFiles: string[] = [];
  const lowCoverageFiles: string[] = [];

  for (const [absPath, cov] of byFile.entries()) {
    const rel = path.relative(path.join(cwd, 'src'), absPath);
    if (cov.statements === 0) {
      untestedFiles.push(rel);
    } else if (cov.statements < 50) {
      lowCoverageFiles.push(`${rel} (${cov.statements}%)`);
    }
  }

  return { untestedFiles, lowCoverageFiles };
}

/**
 * Check which routes have E2E test coverage.
 */
function checkRouteCoverage(cwd: string): {
  routesCoveredByE2E: string[];
  routesMissingE2E: string[];
} {
  const allRoutes = ['/', '/comparison', '/forecast', '/tax', '/portfolio', '/rates'];
  const e2eDir = path.join(cwd, 'e2e');

  if (!fs.existsSync(e2eDir)) {
    return { routesCoveredByE2E: [], routesMissingE2E: allRoutes };
  }

  // Collect all test file contents and look for goto('/route')
  const testFiles = fs.readdirSync(e2eDir).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
  const combinedContent = testFiles
    .map((f) => fs.readFileSync(path.join(e2eDir, f), 'utf-8'))
    .join('\n');

  const covered: string[] = [];
  const missing: string[] = [];

  for (const route of allRoutes) {
    // Match page.goto('/route') or page.goto('/route/') patterns
    const escaped = route === '/' ? `goto\\('/'\\)` : `goto\\('${route}`;
    const found = new RegExp(escaped).test(combinedContent);
    if (found) {
      covered.push(route);
    } else {
      missing.push(route);
    }
  }

  return { routesCoveredByE2E: covered, routesMissingE2E: missing };
}

function countTestFiles(cwd: string): number {
  const testDir = path.join(cwd, 'src', '__tests__');
  if (!fs.existsSync(testDir)) return 0;
  return fs
    .readdirSync(testDir)
    .filter((f) => f.endsWith('.test.ts') || f.endsWith('.test.tsx'))
    .length;
}

function generateRecommendations(
  global: { statements: number; functions: number; branches: number },
  byModule: ModuleCoverage[],
  gaps: { untestedFiles: string[]; lowCoverageFiles: string[]; routesMissingE2E: string[] },
): string[] {
  const recs: string[] = [];

  // Lowest coverage modules first
  const lowModules = byModule.filter((m) => m.statements < 60);
  if (lowModules.length > 0) {
    const names = lowModules.map((m) => `${m.module} (${m.statements}%)`).join(', ');
    recs.push(`Low coverage modules: ${names}. Add unit tests for these areas.`);
  }

  if (gaps.untestedFiles.length > 0) {
    recs.push(`${gaps.untestedFiles.length} files have zero coverage: ${gaps.untestedFiles.slice(0, 3).join(', ')}${gaps.untestedFiles.length > 3 ? '…' : ''}.`);
  }

  if (gaps.routesMissingE2E.length > 0) {
    recs.push(`Missing E2E coverage for routes: ${gaps.routesMissingE2E.join(', ')}.`);
  }

  if (global.branches < 70) {
    recs.push(`Branch coverage is ${global.branches}% (target: 70%). Focus on edge cases and error paths.`);
  }

  if (recs.length === 0) {
    recs.push('Coverage is healthy across all modules. Maintain by adding tests alongside new features.');
  }

  return recs;
}

function main() {
  const cwd = process.cwd();
  const outputFile = process.argv[2] ?? 'coverage/analysis.json';
  const testResultsFile = process.argv[3] ?? 'coverage/test-results.json';

  console.log('📊 Analyzing test quality...');

  // Parse real coverage from coverage-final.json (written by npm run test:coverage)
  const coverageFile = path.join(cwd, 'coverage', 'coverage-final.json');
  const { global: globalCoverage, byFile } = parseCoverageFinal(coverageFile);
  console.log(`✓ Coverage: ${globalCoverage.statements}% statements, ${globalCoverage.functions}% functions, ${globalCoverage.branches}% branches`);

  // Parse test results (optional, from vitest --reporter=json)
  const { total, passed, passRate } = parseTestResultsJson(testResultsFile);
  const totalTestFiles = countTestFiles(cwd);
  console.log(`✓ Test files: ${totalTestFiles}${total > 0 ? `, ${passed}/${total} passed` : ''}`);

  // Aggregate coverage by module
  const byModule = aggregateByModule(byFile, cwd);
  console.log(`✓ Modules with coverage data: ${byModule.length}`);

  // Identify gaps
  const { untestedFiles, lowCoverageFiles } = findCoverageGaps(byFile, cwd);
  const { routesCoveredByE2E, routesMissingE2E } = checkRouteCoverage(cwd);
  console.log(`✓ Gaps: ${untestedFiles.length} untested files, ${routesMissingE2E.length} routes without E2E`);

  // Generate recommendations
  const recommendations = generateRecommendations(globalCoverage, byModule, {
    untestedFiles,
    lowCoverageFiles,
    routesMissingE2E,
  });

  const analysis: TestAnalysis = {
    totalTests: total,
    totalTestFiles,
    passRate,
    coverage: {
      lines: globalCoverage.statements, // v8 doesn't track lines separately; statements ≈ lines
      functions: globalCoverage.functions,
      branches: globalCoverage.branches,
      statements: globalCoverage.statements,
    },
    byModule,
    gaps: {
      untestedFiles,
      lowCoverageFiles,
      routesCoveredByE2E,
      routesMissingE2E,
    },
    recommendations,
    timestamp: new Date().toISOString(),
  };

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputFile, JSON.stringify(analysis, null, 2));
  console.log(`✓ Analysis written to ${outputFile}`);
}

main();
