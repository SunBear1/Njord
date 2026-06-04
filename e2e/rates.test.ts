import { test, expect } from '@playwright/test';
import {
  CURRENCY_URL,
  VALID_CURRENCY_RESPONSE,
} from './fixtures';

test.describe('/rates — currency exchange', () => {
  test('rates page loads with heading and description', async ({ page }) => {
    await page.route(CURRENCY_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_CURRENCY_RESPONSE }),
    );

    await page.goto('/rates');
    await page.waitForSelector('main', { timeout: 10_000 });

    await expect(page.getByRole('heading', { name: 'Kursy walut' })).toBeVisible();
    await expect(page.getByText('Porównanie kursów z perspektywy użytkownika')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Kupujesz' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Sprzedajesz' }).first()).toBeVisible();
  });

  test('shows Alior and NBP buy/sell rates after API loads', async ({ page }) => {
    await page.route(CURRENCY_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_CURRENCY_RESPONSE }),
    );

    await page.goto('/rates');
    await page.waitForSelector('main', { timeout: 10_000 });

    await expect(page.getByText('3.9200')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('4.1800')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('3.9500')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('4.1000')).toBeVisible({ timeout: 5_000 });
  });

  test('shows loading indicator while API is pending', async ({ page }) => {
    await page.route(CURRENCY_URL, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({ status: 200, json: VALID_CURRENCY_RESPONSE });
    });

    await page.goto('/rates');
    await page.waitForSelector('main', { timeout: 10_000 });

    await expect(page.getByText(/Pobieram kursy walut/i)).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('3.9200')).toBeVisible({ timeout: 5_000 });
  });

  test('shows error when currency API fails', async ({ page }) => {
    await page.route(CURRENCY_URL, (route) =>
      route.fulfill({ status: 500, json: { error: 'Internal Server Error' } }),
    );

    await page.goto('/rates');
    await page.waitForSelector('main', { timeout: 10_000 });

    await expect(page.getByText(/Nie udało się pobrać kursów walut/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('main')).toBeVisible();
  });
});
