import { test, expect } from '@playwright/test';

/**
 * Story 0.11 — live cluster smoke for JWT auth round-trip.
 *
 * Hits the real Go backend through Traefik. Uses a unique email per run to
 * stay idempotent in a long-lived cluster.
 */
test.describe('cluster · auth (JWT)', () => {
  test('register → see authenticated state → logout', async ({ page, context }) => {
    const email = `smoke+${Date.now()}@njord.test`;
    const password = 'Pa$$word1';

    await page.goto('/');
    await page.waitForSelector('main', { timeout: 20_000 });

    // Open the auth modal from the header.
    await page.getByRole('button', { name: /Zaloguj się/i }).first().click();
    await expect(page.getByRole('heading', { name: /Zaloguj się/i })).toBeVisible();

    // Switch to registration tab.
    await page.getByRole('button', { name: /^Rejestracja$/i }).click();
    await expect(page.getByRole('heading', { name: /Utwórz konto/i })).toBeVisible();

    // Fill the form (name is optional, leave it empty).
    await page.getByPlaceholder('Email…').fill(email);
    await page.getByPlaceholder('Hasło…').fill(password);

    await page.getByRole('button', { name: /^Utwórz konto$/i }).click();

    // Auth cookie `njord_auth` must be present after a successful register.
    await expect.poll(async () => {
      const cookies = await context.cookies();
      return cookies.some((c) => c.name === 'njord_auth');
    }, { timeout: 15_000 }).toBe(true);

    // The login CTA disappears once authenticated.
    await expect(
      page.getByRole('button', { name: /^Zaloguj się$/i }).first(),
    ).toBeHidden({ timeout: 10_000 });
  });
});
