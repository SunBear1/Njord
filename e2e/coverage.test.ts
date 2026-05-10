import { test, expect } from '@playwright/test';

// ─── Shared mock data ─────────────────────────────────────────────────────────

const MARKET_DATA_URL = '**/api/v1/finance/stocks/**';
const NBP_URL = 'https://api.nbp.pl/**';
const CURRENCY_URL = '**/api/v1/finance/currency**';

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

const VALID_CURRENCY_RESPONSE = {
  data: [
    { source: 'alior', pair: 'USD/PLN', bid: 3.92, ask: 4.18, mid: 4.05, timestamp: '2026-05-10T10:00:00Z' },
    { source: 'nbp', pair: 'USD/PLN', bid: 3.95, ask: 4.10, mid: 4.025, timestamp: '2026-05-10T00:00:00Z' },
  ],
};

const NBP_RATE_RESPONSE = {
  rates: [{ mid: 4.00, effectiveDate: '2024-06-13' }],
};

// ─── /rates ───────────────────────────────────────────────────────────────────

test.describe('/rates — currency exchange', () => {
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

// ─── /forecast ────────────────────────────────────────────────────────────────

test.describe('/forecast — price forecast', () => {
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

// ─── /tax ─────────────────────────────────────────────────────────────────────

test.describe('/tax — Belka tax calculator', () => {
  test('NBP rate auto-fetches after sale date is entered', async ({ page }) => {
    await page.route(NBP_URL, (route) =>
      route.fulfill({ status: 200, json: NBP_RATE_RESPONSE }),
    );
    await page.route(CURRENCY_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_CURRENCY_RESPONSE }),
    );

    await page.goto('/tax');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.getByRole('button', { name: /Dodaj transakcję/i }).click();
    // Expand the newly added transaction card before filling fields
    await page.getByRole('button', { name: /Transakcja 1/i }).click();
    await page.getByLabel(/Data sprzedaży/i).fill('14/06/2024');

    await expect(page.getByText(/Kurs NBP: 4,0000|Kurs NBP: 4\.0000/)).toBeVisible({ timeout: 5_000 });
  });

  test('Belka tax 19% computed on profit — sale $1500, cost $1000, rate 4.00', async ({ page }) => {
    await page.route(NBP_URL, (route) =>
      route.fulfill({ status: 200, json: NBP_RATE_RESPONSE }),
    );
    await page.route(CURRENCY_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_CURRENCY_RESPONSE }),
    );

    await page.goto('/tax');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.getByRole('button', { name: /Dodaj transakcję/i }).click();
    // Expand the newly added transaction card before filling fields
    await page.getByRole('button', { name: /Transakcja 1/i }).click();

    await page.getByLabel(/Data sprzedaży/i).fill('14/06/2024');
    await page.getByLabel(/Kwota sprzedaży brutto/i).fill('1500');

    await page.getByLabel(/Data nabycia/i).fill('07/06/2024');
    await page.getByRole('spinbutton', { name: /Koszt nabycia/i }).fill('1000');

    // Wait for both NBP rates to auto-fetch (debounce 500ms each + network)
    // Revenue: 1500×4.00=6000 PLN, cost: 1000×4.00=4000 PLN, profit: 2000 PLN
    // Belka 19%: 2000×0.19 = 380.00 PLN
    await expect(page.getByText(/380,00 zł/)).toBeVisible({ timeout: 8_000 });
  });

  test('loss transaction shows zero tax', async ({ page }) => {
    await page.route(NBP_URL, (route) =>
      route.fulfill({ status: 200, json: NBP_RATE_RESPONSE }),
    );
    await page.route(CURRENCY_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_CURRENCY_RESPONSE }),
    );

    await page.goto('/tax');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.getByRole('button', { name: /Dodaj transakcję/i }).click();
    // Expand the newly added transaction card before filling fields
    await page.getByRole('button', { name: /Transakcja 1/i }).click();

    await page.getByLabel(/Data sprzedaży/i).fill('14/06/2024');
    await page.getByLabel(/Kwota sprzedaży brutto/i).fill('1000');

    await page.getByLabel(/Data nabycia/i).fill('07/06/2024');
    await page.getByRole('spinbutton', { name: /Koszt nabycia/i }).fill('1500');

    // Loss: 1000×4.00 - 1500×4.00 = -2000 PLN → tax = 0
    await expect(page.getByText(/Strata/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/0,00 zł/)).toBeVisible({ timeout: 5_000 });
  });

  test('removing all transactions shows empty state', async ({ page }) => {
    await page.route(NBP_URL, (route) =>
      route.fulfill({ status: 200, json: NBP_RATE_RESPONSE }),
    );
    await page.route(CURRENCY_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_CURRENCY_RESPONSE }),
    );

    await page.goto('/tax');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.getByRole('button', { name: /Dodaj transakcję/i }).click();
    await expect(page.getByRole('button', { name: /Transakcja 1/i })).toBeVisible();

    await page.getByRole('button', { name: /Usuń wszystkie transakcje/i }).click();
    await page.getByRole('button', { name: /Tak, usuń/i }).click();

    await expect(page.getByText(/Dodaj pierwszą transakcję sprzedaży/i)).toBeVisible({ timeout: 3_000 });
  });
});

// ─── /comparison — supplementary ─────────────────────────────────────────────

test.describe('/comparison — supplementary coverage', () => {
  test('verdict section contains PLN values after analysis', async ({ page }) => {
    await page.route('**/api/v1/finance/stocks/**', (route) =>
      route.fulfill({ status: 200, json: VALID_ASSET_RESPONSE }),
    );
    await page.route(NBP_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_NBP_HISTORICAL_RESPONSE }),
    );
    await page.route('**/api/v1/finance/inflation**', (route) =>
      route.fulfill({ status: 200, json: { data: [{ year: 2026, month: 3, cpi_yoy_pct: 2.4 }] } }),
    );

    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    const assetButton = page.getByRole('button', { name: /Twój portfel akcji/i });
    if ((await assetButton.getAttribute('aria-expanded')) !== 'true') {
      await assetButton.click();
    }

    await page.locator('#comparison-ticker').fill('AAPL');
    await page.getByRole('button', { name: /Odśwież dane giełdowe/i }).click();
    await expect(page.getByText(/Apple Inc\./)).toBeVisible({ timeout: 8_000 });

    await page.locator('#comparison-shares').fill('10');
    await page.locator('#comparison-avg-cost').fill('100');

    const benchmarkButton = page.getByRole('button', { name: /Reinwestycja i horyzont/i });
    if ((await benchmarkButton.getAttribute('aria-expanded')) !== 'true') {
      await benchmarkButton.click();
    }

    await page.getByRole('button', { name: /^ETF$/ }).click();
    await page.getByRole('button', { name: /Analizuj scenariusze/i }).click();

    await expect(page.getByText('Przewaga netto')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/zł/).first()).toBeVisible({ timeout: 5_000 });
  });
});
