import { test, expect } from '@playwright/test';

test.describe('Bitcoin Bank smoke', () => {
  test('landing page shows connect prompt', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Bitcoin Bank' })).toBeVisible();
    await expect(page.getByText('Connect with Nostr to view your balance')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect with Nostr' })).toBeVisible();
  });

  test.describe('with mocked Nostr and API', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { nostr?: object }).nostr = {
          getPublicKey: async () => 'npub1mock1234567890abcdefghijklmnopqrstuvwxyz123',
          signEvent: async () => ({ sig: 'mocksig', id: 'mockid' }),
        };
      });

      await page.route('**/api/**', async (route) => {
        const url = route.request().url();
        if (url.includes('/balance/')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ balance_msats: 100000, savings_msats: 50000, savings_apy: 5 }),
          });
        }
        if (url.includes('/transactions/')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ transactions: [] }),
          });
        }
        if (url.includes('/challenge')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ challenge: 'ch', expires_at: Date.now() / 1000 + 60 }),
          });
        }
        if (url.includes('/nwc/connect')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ connection_uri: 'nostr+connect://mock' }),
          });
        }
        return route.fallback();
      });
    });

    test('connect flow shows dashboard with nav links', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Connect with Nostr' }).click();
      await expect(page.getByRole('heading', { name: 'Bitcoin Bank' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Deposit' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Withdraw' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Transfer' })).toBeVisible();
    });

    test('navigate to deposit page', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Connect with Nostr' }).click();
      await page.getByRole('link', { name: 'Deposit' }).click();
      await expect(page).toHaveURL(/\/deposit/);
    });

    test('navigate to withdraw page', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Connect with Nostr' }).click();
      await page.getByRole('link', { name: 'Withdraw' }).click();
      await expect(page).toHaveURL(/\/withdraw/);
    });

    test('navigate to transfer page', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Connect with Nostr' }).click();
      await page.getByRole('link', { name: 'Transfer' }).click();
      await expect(page).toHaveURL(/\/transfer/);
    });

    test('Connect NWC flow shows connection URI and copy button', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Connect with Nostr' }).click();
      await expect(page.getByRole('button', { name: 'Connect NWC' })).toBeVisible();
      await page.getByRole('button', { name: 'Connect NWC' }).click();
      await expect(page.getByText('nostr+connect://mock')).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
    });
  });
});
