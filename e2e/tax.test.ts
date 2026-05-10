import { test, expect } from '@playwright/test';
import {
  MARKET_DATA_URL,
  NBP_RATE_URL,
  CURRENCY_URL,
  NBP_RATE_RESPONSE,
  VALID_CURRENCY_RESPONSE,
} from './fixtures';

test.describe('/tax — Belka tax calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(NBP_RATE_URL, (route) =>
      route.fulfill({ status: 200, json: NBP_RATE_RESPONSE }),
    );
    await page.route(CURRENCY_URL, (route) =>
      route.fulfill({ status: 200, json: VALID_CURRENCY_RESPONSE }),
    );
    await page.route(MARKET_DATA_URL, (route) => route.abort());
  });

  test('navigation to tax calculator works', async ({ page }) => {
    await page.goto('/tax');
    await page.waitForSelector('main', { timeout: 10_000 });
    await expect(page.getByText(/Kalkulator podatku Belki/i)).toBeVisible({ timeout: 5_000 });
  });

  test('tax calculator shows add transaction button', async ({ page }) => {
    await page.goto('/tax');
    await page.waitForSelector('main', { timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Dodaj/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('NBP rate auto-fetches after sale date is entered', async ({ page }) => {
    await page.goto('/tax');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.getByRole('button', { name: /Dodaj transakcję/i }).click();
    await page.getByRole('button', { name: /Transakcja 1/i }).click();
    await page.getByLabel(/Data sprzedaży/i).fill('14/06/2024');

    await expect(page.getByText(/Kurs NBP: 4,0000|Kurs NBP: 4\.0000/)).toBeVisible({ timeout: 5_000 });
  });

  test('Belka tax 19% computed on profit — sale $1500, cost $1000, rate 4.00', async ({ page }) => {
    await page.goto('/tax');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.getByRole('button', { name: /Dodaj transakcję/i }).click();
    await page.getByRole('button', { name: /Transakcja 1/i }).click();

    await page.getByLabel(/Data sprzedaży/i).fill('14/06/2024');
    await page.getByLabel(/Kwota sprzedaży brutto/i).fill('1500');

    await page.getByLabel(/Data nabycia/i).fill('07/06/2024');
    await page.getByRole('spinbutton', { name: /Koszt nabycia/i }).fill('1000');

    // Revenue: 1500×4.00=6000 PLN, cost: 1000×4.00=4000 PLN, profit: 2000 PLN
    // Belka 19%: 2000×0.19 = 380.00 PLN
    await expect(page.getByText(/380,00[\s\u00a0]zł/).first()).toBeVisible({ timeout: 8_000 });
  });

  test('loss transaction shows zero tax', async ({ page }) => {
    await page.goto('/tax');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.getByRole('button', { name: /Dodaj transakcję/i }).click();
    await page.getByRole('button', { name: /Transakcja 1/i }).click();

    await page.getByLabel(/Data sprzedaży/i).fill('14/06/2024');
    await page.getByLabel(/Kwota sprzedaży brutto/i).fill('1000');

    await page.getByLabel(/Data nabycia/i).fill('07/06/2024');
    await page.getByRole('spinbutton', { name: /Koszt nabycia/i }).fill('1500');

    // Loss: 1000×4.00 - 1500×4.00 = -2000 PLN → tax = 0
    await expect(page.getByText('Strata', { exact: true })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('brak (strata)')).toBeVisible({ timeout: 5_000 });
  });

  test('removing all transactions shows empty state', async ({ page }) => {
    await page.goto('/tax');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.getByRole('button', { name: /Dodaj transakcję/i }).click();
    await expect(page.getByRole('button', { name: /Transakcja 1/i })).toBeVisible();

    await page.getByRole('button', { name: /Usuń wszystkie transakcje/i }).click();
    await page.getByRole('button', { name: /Tak, usuń/i }).click();

    await expect(page.getByText(/Dodaj pierwszą transakcję sprzedaży/i)).toBeVisible({ timeout: 3_000 });
  });
});
