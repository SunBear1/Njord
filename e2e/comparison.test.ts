import { test, expect } from '@playwright/test';
import {
  MARKET_DATA_URL,
  NBP_URL,
  INFLATION_URL,
  VALID_ASSET_RESPONSE,
  VALID_NBP_HISTORICAL_RESPONSE,
  VALID_INFLATION_RESPONSE,
} from './fixtures';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Page = Parameters<typeof test>[0]['page'];

async function openAssetDropdown(page: Page) {
  const btn = page.getByRole('button', { name: /Twój portfel akcji/i });
  if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
}

async function openBenchmarkDropdown(page: Page) {
  const btn = page.getByRole('button', { name: /Reinwestycja i horyzont/i });
  if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
}

async function setupApiMocks(page: Page) {
  await page.route(MARKET_DATA_URL, (route) =>
    route.fulfill({ status: 200, json: VALID_ASSET_RESPONSE }),
  );
  await page.route(NBP_URL, (route) =>
    route.fulfill({ status: 200, json: VALID_NBP_HISTORICAL_RESPONSE }),
  );
  await page.route(INFLATION_URL, (route) =>
    route.fulfill({ status: 200, json: VALID_INFLATION_RESPONSE }),
  );
}

async function runFullAnalysis(page: Page) {
  await setupApiMocks(page);
  await page.goto('/comparison');
  await page.waitForSelector('main', { timeout: 10_000 });

  await openAssetDropdown(page);
  await page.locator('#comparison-ticker').fill('AAPL');
  await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();
  await expect(page.getByText(/Apple Inc\./)).toBeVisible({ timeout: 8_000 });

  await page.locator('#comparison-shares').fill('10');
  await page.locator('#comparison-avg-cost').fill('100');
  await openBenchmarkDropdown(page);
  await page.getByRole('button', { name: /^ETF$/ }).click();
  await page.getByRole('button', { name: /Analizuj scenariusze/i }).click();
}

async function runSavingsAnalysis(page: Page) {
  await setupApiMocks(page);
  await page.goto('/comparison');
  await page.waitForSelector('main', { timeout: 10_000 });

  await openAssetDropdown(page);
  await page.locator('#comparison-ticker').fill('AAPL');
  await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();
  await expect(page.getByText(/Apple Inc\./)).toBeVisible({ timeout: 8_000 });

  await page.locator('#comparison-shares').fill('10');
  await page.locator('#comparison-avg-cost').fill('100');
  await openBenchmarkDropdown(page);
  await page.locator('#comparison-savings-rate').fill('5,5');
  await page.getByRole('button', { name: /Analizuj scenariusze/i }).click();
}

// ─── Smoke tests ──────────────────────────────────────────────────────────────

test.describe('/comparison — smoke', () => {
  test('page loads with both top inputs collapsed', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    const assetButton = page.getByRole('button', { name: /Twój portfel akcji/i });
    const benchmarkButton = page.getByRole('button', { name: /Reinwestycja i horyzont/i });

    await expect(page.getByRole('heading', { name: /Sprzedać czy trzymać akcje/i })).toBeVisible();
    await expect(assetButton).toHaveAttribute('aria-expanded', 'false');
    await expect(benchmarkButton).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#comparison-ticker')).not.toBeVisible();
    await expect(page.locator('#comparison-savings-rate')).not.toBeVisible();
  });

  test('benchmark selector shows all three options', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await openBenchmarkDropdown(page);
    await expect(page.getByRole('button', { name: /^Konto oszczędnościowe$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Obligacje skarbowe$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^ETF$/ })).toBeVisible();
  });

  test('horizon slider is present', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await openBenchmarkDropdown(page);
    await expect(page.getByRole('slider').first()).toBeVisible();
  });

  test('ticker input accepts text', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await openAssetDropdown(page);
    const tickerInput = page.locator('#comparison-ticker');
    await tickerInput.fill('AAPL');
    await expect(tickerInput).toHaveValue('AAPL');
  });

  test('dropdowns show saved input summaries', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    const assetButton = page.getByRole('button', { name: /Twój portfel akcji/i });
    const benchmarkButton = page.getByRole('button', { name: /Reinwestycja i horyzont/i });

    await openAssetDropdown(page);
    await page.locator('#comparison-ticker').fill('AAPL');
    await page.locator('#comparison-shares').fill('12');
    await page.locator('#comparison-avg-cost').fill('80');

    await openBenchmarkDropdown(page);
    await page.getByRole('button', { name: /^Konto oszczędnościowe$/ }).click();
    await page.locator('#comparison-savings-rate').fill('5,82');

    await expect(assetButton).toContainText('AAPL');
    await expect(benchmarkButton).toContainText('5,82');
    await expect(benchmarkButton).toContainText('Zapisane dane');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Wyczyść dane porównania/i }).click();

    await expect(assetButton).toHaveAttribute('aria-expanded', 'false');
    await expect(benchmarkButton).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#comparison-ticker')).not.toBeVisible();
    await expect(page.locator('#comparison-savings-rate')).not.toBeVisible();
  });

  test('shows yellow warning badges before required fields are completed', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    const assetBadge = page.getByRole('button', { name: /Twój portfel akcji/i }).locator('span').filter({ hasText: 'Do uzupełnienia' }).first();

    await expect(assetBadge).toBeVisible();
    await expect(assetBadge.locator('svg')).toBeVisible();
    await expect(assetBadge).toHaveCSS('color', 'rgb(180, 83, 9)');
    await expect(page.getByRole('heading', { name: 'Sprzedać czy trzymać akcje?' })).toBeVisible();
  });

  test('savings input accepts both dot and comma, dropdown closes with Gotowe', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await openBenchmarkDropdown(page);

    const savingsInput = page.locator('#comparison-savings-rate');
    await savingsInput.fill('3.85');
    await expect(savingsInput).toHaveValue('3.85');

    await savingsInput.fill('3,85');
    await expect(savingsInput).toHaveValue('3,85');

    await page.getByRole('button', { name: /^Gotowe$/ }).click();
    await expect(savingsInput).not.toBeVisible();
  });
});

// ─── API error handling ────────────────────────────────────────────────────────

test.describe('/comparison — API error handling', () => {
  test('API 500 shows an inline error without crashing the page', async ({ page }) => {
    await page.route(MARKET_DATA_URL, (route) =>
      route.fulfill({ status: 500, json: { error: 'Upstream error', code: 'UPSTREAM_ERROR' } }),
    );

    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await openAssetDropdown(page);
    await page.locator('#comparison-ticker').fill('AAPL');
    await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();

    await expect(page.getByText('UPSTREAM_ERROR')).toBeVisible({ timeout: 5_000 });
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

    await openAssetDropdown(page);
    await page.locator('#comparison-ticker').fill('FAKEXYZ');
    await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();

    await expect(page.getByText(/Nie znaleziono tickera/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('main')).toBeVisible();
  });

  test('network timeout does not crash the page', async ({ page }) => {
    await page.route(MARKET_DATA_URL, (route) => route.abort('timedout'));

    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await openAssetDropdown(page);
    await page.locator('#comparison-ticker').fill('AAPL');
    await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();

    await expect(page.getByText(/Failed to fetch|Błąd sieci|nie udało się/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('main')).toBeVisible();
  });
});

// ─── Successful analysis flow ─────────────────────────────────────────────────

test.describe('/comparison — successful analysis flow', () => {
  test('verdict, scenario cards, timeline and stock traits render after explicit submit', async ({ page }) => {
    await runFullAnalysis(page);

    await expect(page.getByText(/wygrywa w scenariuszu bazowym|wygrywają w scenariuszu bazowym/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Przewaga netto')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/Wartość inwestycji w .* po /i)).toBeVisible();
    await expect(page.getByText(/Inflacja w tle 2,4%/i)).toBeVisible();
    await expect(page.getByText(/Scenariusze skrajne/i)).toBeVisible();
    await expect(page.getByText('Wartość w czasie')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/Szara linia przerywana „Siła nabywcza"/i)).toBeVisible();
    await expect(page.getByText(/Cechy kursu spółki Apple Inc\./i)).toBeVisible();
    await expect(page.locator('h2 span').filter({ hasText: 'Apple Inc.' }).first()).toHaveCSS('color', 'rgb(3, 105, 161)');
    await expect(page.getByText('Wystąpił błąd podczas renderowania tego komponentu')).not.toBeVisible();
  });

  test('scenario edit modal updates the bear card values', async ({ page }) => {
    await runFullAnalysis(page);

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

  test('savings reinvestment value is shown once and break-even is outside bear/bull cards', async ({ page }) => {
    await runSavingsAnalysis(page);

    const bearCard = page.getByTestId('comparison-scenario-bear');
    const bullCard = page.getByTestId('comparison-scenario-bull');

    await expect(page.getByText(/Wartość inwestycji w konto oszczędnościowe po /i)).toHaveCount(1);
    await expect(page.getByTestId('comparison-reinvestment-breakeven')).toHaveCount(1);
    await expect(page.getByText(/Próg rentowności względem reinwestycji/i)).toHaveCount(1);
    await expect(bearCard).not.toContainText('Wartość Konto oszcz.');
    await expect(bullCard).not.toContainText('Wartość Konto oszcz.');
    await expect(bearCard).not.toContainText('Próg rentowności');
    await expect(bullCard).not.toContainText('Próg rentowności');
  });

  test('stock traits link opens forecast page with the selected ticker', async ({ page }) => {
    await runFullAnalysis(page);

    await page.getByRole('link', { name: /Pełna prognoza ceny/i }).click();
    await expect(page).toHaveURL(/\/forecast\?ticker=AAPL/);
    await expect(page.locator('#forecast-ticker')).toHaveValue('AAPL');
  });

  test('stock traits stay visible after returning from forecast and remain above the chart', async ({ page }) => {
    await runFullAnalysis(page);

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

  test('verdict section contains PLN values after analysis', async ({ page }) => {
    await runFullAnalysis(page);

    await expect(page.getByText('Przewaga netto')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/zł/).first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Loading states ───────────────────────────────────────────────────────────

test.describe('/comparison — loading states', () => {
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

    await openAssetDropdown(page);
    await page.locator('#comparison-ticker').fill('AAPL');
    await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();

    await expect(page.getByRole('button', { name: /Odśwież dane giełdowe/i })).toBeDisabled();
  });

  test('analyze button stays disabled until both forms are complete', async ({ page }) => {
    await setupApiMocks(page);

    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    const analyzeButton = page.getByRole('button', { name: /Analizuj scenariusze/i });
    await expect(analyzeButton).toBeDisabled();

    await openAssetDropdown(page);
    await page.locator('#comparison-ticker').fill('AAPL');
    await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();
    await expect(page.getByText(/Apple Inc\./)).toBeVisible({ timeout: 8_000 });
    await page.locator('#comparison-shares').fill('10');
    await expect(analyzeButton).toBeDisabled();

    await page.locator('#comparison-avg-cost').fill('100');
    await expect(analyzeButton).toBeDisabled();

    await openBenchmarkDropdown(page);
    await page.locator('#comparison-savings-rate').fill('5,5');
    await expect(analyzeButton).toBeEnabled();

    await analyzeButton.click();
    await expect(page.getByRole('button', { name: /Analizowanie/i })).toBeVisible();
    await expect(page.getByText('Przewaga netto')).toBeVisible({ timeout: 4_000 });
  });

  test('changing inputs after analysis hides results and shows a warning', async ({ page }) => {
    await runFullAnalysis(page);

    await expect(page.getByText('Przewaga netto')).toBeVisible({ timeout: 8_000 });

    await page.getByRole('button', { name: /Twój portfel akcji/i }).click();
    await page.locator('#comparison-shares').fill('12');

    const warning = page.getByText(/Zmieniłeś dane wejściowe po ostatniej analizie/i);
    await expect(warning).toBeVisible();
    await expect(warning).toHaveCSS('color', 'rgb(180, 83, 9)');
    await expect(page.getByText('Przewaga netto')).not.toBeVisible();
    await expect(page.getByText(/Scenariusze skrajne/i)).not.toBeVisible();
    await expect(page.getByText('Wartość w czasie')).not.toBeVisible();
  });
});
