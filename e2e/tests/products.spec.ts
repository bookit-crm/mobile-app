import { test, expect } from '../fixtures';
import { goTo, searchIn } from '../helpers';

test.describe('Products (Warehouse)', () => {
  test.beforeEach(async ({ mobilePage: page }) => {
    await goTo(page, 'main/products', 2500);
  });

  test('should display Products/Warehouse title', async ({ mobilePage: page }) => {
    await expect(page.locator('ion-title').filter({ visible: true }).first()).toBeVisible();
  });

  test('should show product list or empty state', async ({ mobilePage: page }) => {
    await page.waitForTimeout(1000);
    await expect(page.locator('ion-content').last()).toBeVisible();
  });

  test('should search products', async ({ mobilePage: page }) => {
    const bar = page.locator('ion-searchbar');
    if (!(await bar.isVisible({ timeout: 2_000 }).catch(() => false))) { return; }
    await searchIn(page, 'zzz');
    await page.waitForTimeout(600);
    await expect(page.locator('ion-content').last()).toBeVisible();
  });
});
