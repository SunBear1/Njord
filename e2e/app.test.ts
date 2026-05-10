import { test, expect } from '@playwright/test';

test.describe('app — general', () => {
  test('forecast page loads as default route', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main', { timeout: 10_000 });
    await expect(page.getByText(/Prognoza cenowa/i).first()).toBeVisible();
  });

  test('page title is set', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Njord/i);
  });

  test('privacy policy link opens modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main', { timeout: 10_000 });

    const privacyLink = page.getByRole('button', { name: /prywatność|polityka/i }).first();
    await expect(privacyLink).toBeVisible();
    await privacyLink.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });
  });

  test('navbar links navigate between pages', async ({ page }) => {
    await page.goto('/forecast');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.locator('nav').getByRole('link', { name: /Porównanie/i }).click();
    await expect(page).toHaveURL(/\/comparison/);

    await page.locator('nav').getByRole('link', { name: /Prognoza/i }).click();
    await expect(page).toHaveURL(/\/forecast/);

    await page.locator('nav').getByRole('link', { name: /Podatek/i }).click();
    await expect(page).toHaveURL(/\/tax/);

    await page.locator('a[aria-label*="Strona główna"]').click();
    await expect(page).toHaveURL(/\/forecast/);
  });

  test('unknown routes redirect to forecast', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await page.waitForSelector('main', { timeout: 10_000 });
    await expect(page.getByText(/Prognoza cenowa/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
