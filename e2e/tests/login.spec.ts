import { test, expect } from '../fixtures';
import { createMobileContext } from '../fixtures';

/**
 * Login page — smoke tests.
 * Uses a real browser context WITHOUT the JWT pre-injection to test the actual login flow.
 */
test.describe('Login Page', () => {

  test('should display login form with email + password inputs', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**://192.168.1.176:3000/**', r =>
      r.continue({ url: r.request().url().replace('192.168.1.176:3000', 'localhost:3000') }),
    );
    const page = await ctx.newPage();
    await page.goto('http://localhost:8100/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await expect(page.locator('ion-input').nth(0)).toBeVisible();
    await expect(page.locator('ion-input').nth(1)).toBeVisible();
    await expect(page.locator('button.btn-primary')).toBeVisible();
    await ctx.close();
  });

  test('should show logo and tagline', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('http://localhost:8100/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const logo = page.locator('img[alt="ScheDay"], .hero__logo-img, img[src*="logo"]').first();
    await expect(logo).toBeVisible();
    await ctx.close();
  });

  test('should stay on login page with invalid email', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**://192.168.1.176:3000/**', r =>
      r.continue({ url: r.request().url().replace('192.168.1.176:3000', 'localhost:3000') }),
    );
    const page = await ctx.newPage();
    await page.goto('http://localhost:8100/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.locator('ion-input').nth(0).locator('input').fill('not-an-email');
    await page.locator('ion-input').nth(1).locator('input').fill('password123');
    await page.locator('button.btn-primary').click();
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/login');
    await ctx.close();
  });

  test('should navigate to main after successful login', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**://192.168.1.176:3000/**', r =>
      r.continue({ url: r.request().url().replace('192.168.1.176:3000', 'localhost:3000') }),
    );
    const page = await ctx.newPage();
    await page.goto('http://localhost:8100/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    await page.locator('ion-input').nth(0).locator('input').fill('mabego8870@pmdeal.com');
    await page.locator('ion-input').nth(1).locator('input').fill('asdASD123!@#');
    await page.locator('button.btn-primary').click();

    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (!page.url().includes('/login')) break;
      await page.waitForTimeout(400);
    }
    expect(page.url()).not.toContain('/login');
    await ctx.close();
  });
});
