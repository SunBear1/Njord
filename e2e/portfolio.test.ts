import { test, expect } from '@playwright/test';

const AUTH_ME_URL = '**/api/v1/auth/me';
const HOLDINGS_URL = '**/api/v1/portfolio/holdings';
const BONDS_URL = '**/api/v1/finance/bonds**';

const FIXTURE_USER = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  hasPassword: true,
  linkedProviders: [],
};

const FIXTURE_BOND_PRESET = {
  id: 'bond-edo',
  name_pl: 'EDO dziesięcioletnie',
  maturity_months: 120,
  rate_type: 'edo',
  first_year_rate_pct: 5.35,
  margin_pct: 2.0,
  coupon_frequency: 0,
  early_redemption_allowed: true,
  early_redemption_penalty_pct: 2.0,
  is_family: 0,
};

const FIXTURE_HOLDINGS = [
  {
    id: 'stock-1',
    assetClass: 'stock',
    ticker: 'CDR.WA',
    quantity: 25,
    avgPrice: 78.4,
    currency: 'PLN',
    instrumentType: 'stock',
    source: 'manual',
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'bond-1',
    assetClass: 'bond',
    bondPresetId: 'bond-edo',
    principal: 1000,
    purchaseDate: '2025-01-01',
    source: 'manual',
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'savings-1',
    assetClass: 'savings',
    bankName: 'Toyota Bank',
    principal: 5000,
    interestRatePercent: 5.25,
    asOfDate: '2025-01-01',
    source: 'manual',
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'term-deposit-1',
    assetClass: 'termDeposit',
    bankName: 'mBank',
    principal: 15000,
    interestRatePercent: 5.5,
    openDate: '2025-06-01',
    maturityDate: '2026-06-01',
    source: 'manual',
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

test.describe('/portfolio — auth gate', () => {
  test('unauthenticated visit shows the login gate, not portfolio content', async ({ page }) => {
    await page.route(AUTH_ME_URL, (route) =>
      route.fulfill({ status: 401, json: { error: 'Nie jesteś zalogowany.' } }),
    );

    await page.goto('/portfolio');
    await page.waitForSelector('main', { timeout: 10_000 });

    await expect(page.getByText('Zaloguj się, aby zobaczyć swój portfel')).toBeVisible();
    await expect(page.getByText('Łączna wartość portfela')).not.toBeVisible();
  });
});

test.describe('/portfolio — authenticated dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(AUTH_ME_URL, (route) => route.fulfill({ status: 200, json: FIXTURE_USER }));
    await page.route(BONDS_URL, (route) =>
      route.fulfill({ status: 200, json: { data: [FIXTURE_BOND_PRESET], _meta: { source: 'd1' } } }),
    );
    await page.route(HOLDINGS_URL, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: { holdings: FIXTURE_HOLDINGS } });
      }
      return route.continue();
    });
  });

  test('renders the summary strip, allocation chart, and both asset sections', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForSelector('main', { timeout: 10_000 });

    await expect(page.getByText('Łączna wartość portfela')).toBeVisible();
    await expect(page.getByText('Alokacja portfela')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Mój portfel' })).toBeVisible();
    await expect(page.getByText('CDR.WA')).toBeVisible();
    await expect(page.getByText('EDO dziesięcioletnie')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Oszczędności' })).toBeVisible();
    await expect(page.getByText('Toyota Bank')).toBeVisible();
    await expect(page.getByText('Lokata do 2026-06-01')).toBeVisible();

    await expect(page.getByText('Kreator portfela')).toHaveCount(0);
  });
});
