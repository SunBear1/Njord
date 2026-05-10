import { test, expect } from '@playwright/test';
import {
  MARKET_DATA_URL,
  NBP_URL,
  VALID_ASSET_RESPONSE,
  VALID_NBP_HISTORICAL_RESPONSE,
} from './fixtures';

test.describe('/forecast — price forecast', () => {
  test('price forecast page loads with ticker input', async ({ page }) => {
    await page.goto('/forecast');
    await page.waitForSelector('main', { timeout: 10_000 });
    await expect(page.getByText(/Prognoza cenowa/i).first()).toBeVisible();
    await expect(page.locator('#forecast-ticker')).toBeVisible();
  });

  test('deep-link ?ticker=AAPL pre-fills the input', async ({ page }) => {
    await page.goto('/forecast?ticker=AAPL');
    await page.waitForSelector('main', { timeout: 10_000 });

    await expect(page.locator('#forecast-ticker')).toHaveValue('AAPL');
  });

  test('renders company name and chart after Analizuj with mocked data', async ({ page }) => {
    await page.route(MARKET_DATA_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_ASSET_RESPONSE }),
    );
    await page.route(NBP_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_NBP_HISTORICAL_RESPONSE }),
    );

    await page.goto('/forecast');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.locator('#forecast-ticker').fill('AAPL');
    await page.getByRole('button', { name: /Analizuj/i }).click();

    await expect(page.getByText('Apple Inc.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('AAPL').first()).toBeVisible();
  });

  test('shows role=alert error for invalid ticker', async ({ page }) => {
    await page.route(MARKET_DATA_URL, (route) =>
      route.fulfill({
        status: 404,
        json: { error: 'Ticker FAKEXYZ not found', code: 'TICKER_NOT_FOUND' },
      }),
    );

    await page.goto('/forecast');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.locator('#forecast-ticker').fill('FAKEXYZ');
    await page.getByRole('button', { name: /Analizuj/i }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('main')).toBeVisible();
  });

  test('deep-link auto-fetches and shows results when data is mocked', async ({ page }) => {
    await page.route(MARKET_DATA_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_ASSET_RESPONSE }),
    );
    await page.route(NBP_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_NBP_HISTORICAL_RESPONSE }),
    );

    await page.goto('/forecast?ticker=AAPL');
    await page.waitForSelector('main', { timeout: 10_000 });

    await expect(page.getByText('Apple Inc.')).toBeVisible({ timeout: 10_000 });
  });
});
