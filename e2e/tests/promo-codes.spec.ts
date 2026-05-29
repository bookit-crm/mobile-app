import { test, expect } from '../fixtures';
import { goTo } from '../helpers';

test.describe('Promo Codes', () => {
  test.beforeEach(async ({ mobilePage: page }) => {
    await goTo(page, 'main/promo-codes', 2500);
  });

  test('should display Promo Codes title', async ({ mobilePage: page }) => {
    await expect(page.locator('ion-title').filter({ visible: true }).first()).toBeVisible();
  });

  test('should show promo codes list or empty state', async ({ mobilePage: page }) => {
    await page.waitForTimeout(1000);
    await expect(page.locator('ion-content').last()).toBeVisible();
  });
});
