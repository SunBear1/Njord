import { test, expect } from '@playwright/test';

const MARKET_DATA_URL = '**/api/v1/finance/stocks/**';
const NBP_URL = 'https://api.nbp.pl/**';
const INFLATION_URL = '**/api/v1/finance/inflation';

const VALID_ASSET_RESPONSE = {
  data: Array.from({ length: 252 }, (_, index) => ({
    timestamp: Math.floor(Date.now() / 1000) - index * 86_400,
    open: 150 * (1 + Math.sin(index * 0.1) * 0.05),
    high: 155 * (1 + Math.sin(index * 0.1) * 0.05),
    low: 145 * (1 + Math.sin(index * 0.1) * 0.05),
    close: 150 * (1 + Math.sin(index * 0.1) * 0.05),
    volume: 1_000_000,
  })),
  _meta: {
    source: 'yahoo',
    name: 'Apple Inc.',
    currency: 'USD',
    type: 'stock',
    currentPrice: 150,
  },
};

const VALID_NBP_HISTORICAL_RESPONSE = {
  rates: Array.from({ length: 252 }, (_, index) => ({
    effectiveDate: new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10),
    mid: 4.0 * (1 + Math.sin(index * 0.05) * 0.02),
  })),
};

const VALID_INFLATION_RESPONSE = {
  data: [
    { year: 2026, month: 3, cpi_yoy_pct: 2.4 },
  ],
};

async function configureComparisonForAnalysis(page: Parameters<typeof test>[0]['page']) {
  await page.route(MARKET_DATA_URL, (route) =>
    route.fulfill({ status: 200, json: VALID_ASSET_RESPONSE }),
  );
  await page.route(NBP_URL, (route) =>
    route.fulfill({ status: 200, json: VALID_NBP_HISTORICAL_RESPONSE }),
  );
  await page.route(INFLATION_URL, (route) =>
    route.fulfill({ status: 200, json: VALID_INFLATION_RESPONSE }),
  );

  await page.goto('/comparison');
  await page.waitForSelector('main', { timeout: 10_000 });

  await page.locator('#comparison-ticker').fill('AAPL');
  await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();
  await expect(page.getByText(/Apple Inc\./)).toBeVisible({ timeout: 8_000 });

  await page.locator('#comparison-shares').fill('10');
  await page.locator('#comparison-avg-cost').fill('100');
  await page.getByRole('button', { name: /Reinwestycja i horyzont/i }).click();
  await page.getByRole('button', { name: /^ETF$/ }).click();
  await page.getByRole('button', { name: /Analizuj scenariusze/i }).click();
}

test.describe('Comparison page — API error handling', () => {
  test('API 500 shows an inline error without crashing the page', async ({ page }) => {
    await page.route(MARKET_DATA_URL, (route) =>
      route.fulfill({ status: 500, json: { error: 'Upstream error', code: 'UPSTREAM_ERROR' } }),
    );

    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.locator('#comparison-ticker').fill('AAPL');
    await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();

    await expect(page.locator('.text-danger').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('main')).toBeVisible();
  });

  test('TICKER_NOT_FOUND shows actionable feedback', async ({ page }) => {
    await page.route(MARKET_DATA_URL, (route) =>
      route.fulfill({
        status: 404,
        json: { error: 'Ticker FAKEXYZ not found', code: 'TICKER_NOT_FOUND' },
      }),
    );

    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.locator('#comparison-ticker').fill('FAKEXYZ');
    await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();

    await expect(page.locator('.text-danger').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('main')).toBeVisible();
  });

  test('network timeout does not crash the comparison page', async ({ page }) => {
    await page.route(MARKET_DATA_URL, (route) => route.abort('timedout'));

    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.locator('#comparison-ticker').fill('AAPL');
    await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();

    await expect(page.locator('.text-danger').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Comparison page — successful analysis flow', () => {
  test('verdict, scenario cards, timeline and stock traits render after explicit submit', async ({ page }) => {
    await configureComparisonForAnalysis(page);

    await expect(page.getByText(/wygrywa w scenariuszu bazowym|wygrywają w scenariuszu bazowym/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Przewaga netto')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/Posiadany kapitał po .* po zainwestowaniu w /i)).toBeVisible();
    await expect(page.getByText(/Inflacja w tle 2,4%/i)).toBeVisible();
    await expect(page.getByText(/Scenariusze skrajne/i)).toBeVisible();
    await expect(page.getByText('Wartość w czasie')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/Szara linia przerywana „Siła nabywcza"/i)).toBeVisible();
    await expect(page.getByText(/Cechy kursu spółki Apple Inc\./i)).toBeVisible();
    await expect(page.locator('h2 span').filter({ hasText: 'Apple Inc.' }).first()).toHaveCSS('color', 'rgb(3, 105, 161)');
    await expect(page.getByText('O tyle więcej zostaje po podatku w scenariuszu bazowym przy zwycięskiej decyzji.')).not.toBeVisible();
    await expect(page.getByText('Tyle wynosi przewaga zwycięzcy po podatku w scenariuszu bazowym.')).not.toBeVisible();
    await expect(page.getByText('Wystąpił błąd podczas renderowania tego komponentu')).not.toBeVisible();
  });

  test('scenario edit modal updates the bear card values', async ({ page }) => {
    await configureComparisonForAnalysis(page);

    const bearCard = page.getByTestId('comparison-scenario-bear');
    await bearCard.getByRole('button', { name: /Edytuj scenariusz Bear/i }).click();

    await page.locator('#scenario-stock-price').fill('130');
    await page.locator('#scenario-fx-rate').fill('4,3000');
    await page.getByRole('button', { name: /^Zapisz$/ }).click();

    await expect(bearCard).toContainText('$130.00');
    await expect(bearCard).toContainText('4,3');
    await expect(bearCard.getByText(/Akcje netto/i)).not.toBeVisible();
    await expect(bearCard.getByTestId('comparison-scenario-bear-metric')).toHaveCount(2);
  });

  test('stock traits link opens forecast page with the selected ticker', async ({ page }) => {
    await configureComparisonForAnalysis(page);

    await page.getByRole('link', { name: /Pełna prognoza ceny/i }).click();
    await expect(page).toHaveURL(/\/forecast\?ticker=AAPL/);
    await expect(page.locator('#forecast-ticker')).toHaveValue('AAPL');
  });

  test('stock traits stay visible after returning from forecast and remain above the chart', async ({ page }) => {
    await configureComparisonForAnalysis(page);

    const stockTraitsHeading = page.getByRole('heading', { name: /Cechy kursu spółki Apple Inc\./i });
    const timelineHeading = page.getByText('Wartość w czasie');

    await page.getByRole('link', { name: /Pełna prognoza ceny/i }).click();
    await expect(page).toHaveURL(/\/forecast\?ticker=AAPL/);

    await page.goBack();
    await page.waitForURL(/\/comparison/);
    await expect(stockTraitsHeading).toBeVisible({ timeout: 8_000 });
    await expect(timelineHeading).toBeVisible({ timeout: 8_000 });

    const stockTraitsBox = await stockTraitsHeading.boundingBox();
    const timelineBox = await timelineHeading.boundingBox();

    expect(stockTraitsBox?.y).toBeLessThan(timelineBox?.y ?? Number.POSITIVE_INFINITY);
  });
});

test.describe('Comparison page — loading states', () => {
  test('ticker row shows a spinner while market data is loading', async ({ page }) => {
    await page.route(NBP_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_NBP_HISTORICAL_RESPONSE }),
    );
    await page.route(INFLATION_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_INFLATION_RESPONSE }),
    );
    await page.route(MARKET_DATA_URL, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({ status: 200, json: VALID_ASSET_RESPONSE });
    });

    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.locator('#comparison-ticker').fill('AAPL');
    await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();

    await expect(page.locator('.animate-spin').first()).toBeVisible({ timeout: 3_000 });
  });

  test('analyze button stays disabled until both forms are complete and waits 0.5s before showing results', async ({ page }) => {
    await page.route(MARKET_DATA_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_ASSET_RESPONSE }),
    );
    await page.route(NBP_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_NBP_HISTORICAL_RESPONSE }),
    );
    await page.route(INFLATION_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_INFLATION_RESPONSE }),
    );

    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    const analyzeButton = page.getByRole('button', { name: /Analizuj scenariusze/i });
    await expect(analyzeButton).toBeDisabled();

    await page.locator('#comparison-ticker').fill('AAPL');
    await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();
    await expect(page.getByText(/Apple Inc\./)).toBeVisible({ timeout: 8_000 });
    await page.locator('#comparison-shares').fill('10');
    await expect(analyzeButton).toBeDisabled();

    await page.locator('#comparison-avg-cost').fill('100');
    await expect(analyzeButton).toBeDisabled();

    await page.getByRole('button', { name: /Reinwestycja i horyzont/i }).click();
    await page.locator('#comparison-savings-rate').fill('5,5');
    await expect(analyzeButton).toBeEnabled();

    const start = Date.now();
    await analyzeButton.click();
    await expect(page.locator('button svg.animate-spin').first()).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByText('Przewaga netto')).not.toBeVisible();
    await expect(page.getByText('Przewaga netto')).toBeVisible({ timeout: 4_000 });
    expect(Date.now() - start).toBeGreaterThanOrEqual(450);
  });
});
