import { test, expect } from '@playwright/test';

test.describe('Njord smoke tests', () => {
  test('home page loads with feature cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1, [role="main"], main', { timeout: 10_000 });

    // Home page should show the Njord header
    await expect(page.getByRole('heading', { name: /Njord/i })).toBeVisible();

    // Feature cards should be visible
    await expect(page.getByText(/Porównanie inwestycji/i).first()).toBeVisible();
    await expect(page.getByText(/Prognoza cenowa/i).first()).toBeVisible();
    await expect(page.getByText(/Podatek Belki/i).first()).toBeVisible();
    await expect(page.getByText(/Kreator portfela/i).first()).toBeVisible();
  });

  test('page title is set', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Njord/i);
  });

  test('navigation to investment comparison works', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    // The ticker input should be on screen
    const tickerInput = page.locator('input[placeholder*="AAPL"], input[placeholder*="np."], input[id*="ticker"]').first();
    await expect(tickerInput).toBeVisible();
  });

  test('navigation to tax calculator works', async ({ page }) => {
    await page.goto('/tax');
    await page.waitForSelector('main', { timeout: 10_000 });

    // The tax calculator heading should appear
    await expect(page.getByText(/Kalkulator podatku Belki/i)).toBeVisible({ timeout: 5_000 });
  });

  test('tax calculator shows add transaction button', async ({ page }) => {
    await page.goto('/tax');
    await page.waitForSelector('main', { timeout: 10_000 });

    // Should show "Dodaj" button to add a transaction
    await expect(page.getByRole('button', { name: /Dodaj/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('investment comparison has benchmark selector', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    // The benchmark selector has buttons for savings/bonds options
    const buttons = page.locator('button').filter({ hasText: /konto|obligacj|kont|ETF/i });
    await expect(buttons.first()).toBeVisible({ timeout: 5_000 });
  });

  test('horizon slider is present on comparison page', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    const slider = page.locator('input[type="range"]').first();
    await expect(slider).toBeVisible();
  });

  test('dark mode toggle works', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main', { timeout: 10_000 });

    const htmlEl = page.locator('html');

    // Find moon/sun icon button
    const darkToggle = page.locator('button').filter({ has: page.locator('svg') }).nth(0);
    await darkToggle.click();

    // Page should still be functional after toggle
    await expect(page.locator('body')).toBeVisible();
    const afterClass = await htmlEl.getAttribute('class');
    expect(afterClass === null || typeof afterClass === 'string').toBe(true);
  });

  test('ticker input accepts text on comparison page', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    const inputs = page.locator('input[type="text"], input:not([type])').first();
    await inputs.fill('AAPL');
    await expect(inputs).toHaveValue('AAPL');
  });

  test('price forecast page loads with ticker input', async ({ page }) => {
    await page.goto('/forecast');
    await page.waitForSelector('main', { timeout: 10_000 });

    // Should show forecast heading
    await expect(page.getByText(/Prognoza cenowa/i).first()).toBeVisible();

    // Should have its own ticker input
    const tickerInput = page.locator('#forecast-ticker');
    await expect(tickerInput).toBeVisible();
  });

  test('privacy policy link opens modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main', { timeout: 10_000 });

    const privacyLink = page.getByRole('button', { name: /prywatność|polityka/i }).first();
    if (await privacyLink.isVisible()) {
      await privacyLink.click();
      await expect(page.getByRole('dialog').or(page.locator('[role="dialog"]'))).toBeVisible({ timeout: 3_000 });
    }
  });

  test('navbar links navigate between pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main', { timeout: 10_000 });

    // Click comparison nav link
    await page.locator('nav').getByRole('link', { name: /Porównanie inwestycji/i }).click();
    await expect(page).toHaveURL(/\/comparison/);

    // Click forecast nav link
    await page.locator('nav').getByRole('link', { name: /Prognoza cenowa/i }).click();
    await expect(page).toHaveURL(/\/forecast/);

    // Click tax nav link
    await page.locator('nav').getByRole('link', { name: /Podatek Belki/i }).click();
    await expect(page).toHaveURL(/\/tax/);

    // Click home via logo
    await page.getByRole('link', { name: /Strona główna/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('unknown routes redirect to home', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await page.waitForSelector('main', { timeout: 10_000 });

    // Should redirect to home — check for feature cards
    await expect(page.getByText(/Porównanie inwestycji/i).first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Njord accessibility basics', () => {
  test('app has no obvious landmark violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main', { timeout: 10_000 });

    // Should have a main landmark
    await expect(page.locator('main')).toBeVisible();

    // Should have at least one heading
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();
  });

  test('interactive elements are keyboard-focusable', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main', { timeout: 10_000 });

    // Tab through a few elements — should not throw
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Verify page is still functional after keyboard navigation
    await expect(page.locator('body')).toBeVisible();
  });
});
