import { test, expect } from '@playwright/test';

/**
 * Story 0.11 — live cluster smoke for /forecast.
 *
 * Hits the real Go backend through Traefik, which fetches Yahoo Finance + NBP
 * data. Validates the chart renders and no console errors leak.
 */
test.describe('cluster · /forecast', () => {
  test('SPY forecast renders against live backend with no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/forecast?ticker=SPY');
    await page.waitForSelector('main', { timeout: 20_000 });

    await page.getByRole('button', { name: /Analizuj/i }).click();

    await expect(page.locator('svg.recharts-surface').first()).toBeVisible({
      timeout: 30_000,
    });

    const realErrors = consoleErrors.filter(
      (msg) => !/devtools|favicon|sourcemap|status of 401/i.test(msg),
    );
    expect(realErrors, `unexpected console errors:\n${realErrors.join('\n')}`).toEqual([]);
  });
});
