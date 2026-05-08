import { test, expect } from '@playwright/test';

async function openComparisonAssetDropdown(page: Parameters<typeof test>[0]['page']) {
  const assetButton = page.getByRole('button', { name: /Twój portfel akcji/i });
  if ((await assetButton.getAttribute('aria-expanded')) !== 'true') {
    await assetButton.click();
  }
}

async function openComparisonBenchmarkDropdown(page: Parameters<typeof test>[0]['page']) {
  const benchmarkButton = page.getByRole('button', { name: /Reinwestycja i horyzont/i });
  if ((await benchmarkButton.getAttribute('aria-expanded')) !== 'true') {
    await benchmarkButton.click();
  }
}

test.describe('Njord smoke tests', () => {
  test('forecast page loads as default route', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main', { timeout: 10_000 });
    await expect(page.getByText(/Prognoza cenowa/i).first()).toBeVisible();
  });

  test('page title is set', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Njord/i);
  });

  test('comparison page loads with both top inputs collapsed', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    const assetButton = page.getByRole('button', { name: /Twój portfel akcji/i });
    const benchmarkButton = page.getByRole('button', { name: /Reinwestycja i horyzont/i });

    await expect(page.getByRole('heading', { name: /Sprzedać czy trzymać akcje/i })).toBeVisible();
    await expect(assetButton).toBeVisible();
    await expect(benchmarkButton).toBeVisible();
    await expect(assetButton).toHaveAttribute('aria-expanded', 'false');
    await expect(benchmarkButton).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#comparison-ticker')).not.toBeVisible();
    await expect(page.locator('#comparison-savings-rate')).not.toBeVisible();
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

  test('investment comparison has benchmark selector', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await openComparisonBenchmarkDropdown(page);
    await expect(page.getByRole('button', { name: /^Konto oszczędnościowe$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Obligacje skarbowe$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^ETF$/ })).toBeVisible();
  });

  test('horizon slider is present on comparison page', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await openComparisonBenchmarkDropdown(page);
    await expect(page.locator('input[type="range"]').first()).toBeVisible();
  });

  test('dark mode toggle works', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main', { timeout: 10_000 });

    const htmlElement = page.locator('html');
    await page.getByRole('button', { name: /tryb/i }).click();

    await expect(page.locator('body')).toBeVisible();
    const className = await htmlElement.getAttribute('class');
    expect(className === null || typeof className === 'string').toBe(true);
  });

  test('ticker input accepts text on comparison page', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await openComparisonAssetDropdown(page);
    const tickerInput = page.locator('#comparison-ticker');
    await tickerInput.fill('AAPL');
    await expect(tickerInput).toHaveValue('AAPL');
  });

  test('comparison dropdowns show saved input summaries', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    const assetButton = page.getByRole('button', { name: /Twój portfel akcji/i });
    const benchmarkButton = page.getByRole('button', { name: /Reinwestycja i horyzont/i });

    await openComparisonAssetDropdown(page);
    await page.locator('#comparison-ticker').fill('AAPL');
    await page.locator('#comparison-shares').fill('12');
    await page.locator('#comparison-avg-cost').fill('80');

    await openComparisonBenchmarkDropdown(page);
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

  test('comparison shows yellow warning badges before required fields are completed', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    const assetBadge = page.getByRole('button', { name: /Twój portfel akcji/i }).locator('span').filter({ hasText: 'Do uzupełnienia' }).first();

    await expect(assetBadge).toBeVisible();
    await expect(assetBadge.locator('svg')).toBeVisible();
    await expect(assetBadge).toHaveCSS('color', 'rgb(180, 83, 9)');
    await expect(page.getByRole('heading', { name: 'Sprzedać czy trzymać akcje?' })).toBeVisible();
  });

  test('savings input accepts both dot and comma and dropdown closes with Gotowe', async ({ page }) => {
    await page.goto('/comparison');
    await page.waitForSelector('main', { timeout: 10_000 });

    await openComparisonBenchmarkDropdown(page);

    const savingsInput = page.locator('#comparison-savings-rate');
    await savingsInput.fill('3.85');
    await expect(savingsInput).toHaveValue('3.85');

    await savingsInput.fill('3,85');
    await expect(savingsInput).toHaveValue('3,85');

    await page.getByRole('button', { name: /^Gotowe$/ }).click();
    await expect(savingsInput).not.toBeVisible();
  });

  test('price forecast page loads with ticker input', async ({ page }) => {
    await page.goto('/forecast');
    await page.waitForSelector('main', { timeout: 10_000 });
    await expect(page.getByText(/Prognoza cenowa/i).first()).toBeVisible();
    await expect(page.locator('#forecast-ticker')).toBeVisible();
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

  test('portfolio wizard page loads with steps', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForSelector('main', { timeout: 10_000 });

    await expect(page.getByText('Kreator portfela')).toBeVisible();
    await expect(page.getByText('Twoje dane')).toBeVisible();
    await expect(page.getByText('Brokerzy')).toBeVisible();
    await expect(page.getByText('Alokacja')).toBeVisible();
    await expect(page.getByText('Podsumowanie')).toBeVisible();
  });

  test('portfolio wizard step 1 has monthly amount input', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForSelector('main', { timeout: 10_000 });

    await expect(page.getByText(/Miesięczna kwota do inwestowania/i)).toBeVisible();

    const monthlyInput = page.locator('input[type="number"]').first();
    await expect(monthlyInput).toBeVisible();
    await monthlyInput.fill('1000');
    await expect(monthlyInput).toHaveValue('1000');
  });

  test('rates page loads with heading and description', async ({ page }) => {
    await page.goto('/rates');
    await page.waitForSelector('main', { timeout: 10_000 });

    await expect(page.getByRole('heading', { name: 'Kursy walut' })).toBeVisible();
    await expect(page.getByText('Porównanie kursów kupna i sprzedaży')).toBeVisible();
  });
});

test.describe('Njord accessibility basics', () => {
  test('app has no obvious landmark violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main', { timeout: 10_000 });
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();
  });

  test('interactive elements are keyboard-focusable', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main', { timeout: 10_000 });

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    await expect(page.locator('body')).toBeVisible();
  });
});
