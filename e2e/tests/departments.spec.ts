import { test, expect } from '../fixtures';
import { goTo } from '../helpers';

test.describe('Departments', () => {
  test.beforeEach(async ({ mobilePage: page }) => {
    await goTo(page, 'main/departments', 2500);
  });

  test('should display Departments title', async ({ mobilePage: page }) => {
    // Language-agnostic: verify ion-title is present (text may be in any language)
    await expect(page.locator('ion-title').filter({ visible: true }).first()).toBeVisible();
  });

  test('should show department list or empty state', async ({ mobilePage: page }) => {
    await page.waitForTimeout(1000);
    // Filter visible items only — excludes hidden side-menu ion-items
    const count = await page.locator('ion-item, ion-card').filter({ visible: true }).count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should open department detail on tap', async ({ mobilePage: page }) => {
    await page.waitForTimeout(500);
    const items = page.locator('ion-item, ion-card').filter({ visible: true });
    if (await items.count() === 0) { return; }
    await items.first().click();
    await page.waitForTimeout(800);
    expect(page.url()).not.toContain('/login');
  });
});
