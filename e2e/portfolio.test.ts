import { test, expect } from '@playwright/test';

test.describe('/portfolio — wizard', () => {
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

    const monthlyInput = page.getByRole('spinbutton').first();
    await expect(monthlyInput).toBeVisible();
    await monthlyInput.fill('1000');
    await expect(monthlyInput).toHaveValue('1000');
  });
});
