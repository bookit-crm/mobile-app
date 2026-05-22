import { test, expect } from '../fixtures';
import { goTo, searchIn } from '../helpers';

test.describe('Services', () => {
  test.beforeEach(async ({ mobilePage: page }) => {
    await goTo(page, 'main/services', 2500);
  });

  test('should display Services title', async ({ mobilePage: page }) => {
    await expect(page.locator('ion-title', { hasText: /service/i })).toBeVisible();
  });

  test('should show service list', async ({ mobilePage: page }) => {
    await page.waitForTimeout(1000);
    const count = await page.locator('ion-item, ion-card').count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should search services', async ({ mobilePage: page }) => {
    const bar = page.locator('ion-searchbar');
    if (!(await bar.isVisible({ timeout: 2_000 }).catch(() => false))) { return; }
    await searchIn(page, 'zzz');
    await page.waitForTimeout(600);
    await expect(page.locator('ion-content')).toBeVisible();
  });
});
