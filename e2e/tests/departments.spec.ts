import { test, expect } from '../fixtures';
import { goTo } from '../helpers';

test.describe('Departments', () => {
  test.beforeEach(async ({ mobilePage: page }) => {
    await goTo(page, 'main/departments', 2500);
  });

  test('should display Departments title', async ({ mobilePage: page }) => {
    await expect(page.locator('ion-title', { hasText: /department/i })).toBeVisible();
  });

  test('should show department list', async ({ mobilePage: page }) => {
    await page.waitForTimeout(1000);
    const count = await page.locator('ion-item, ion-card').count();
    expect(count).toBeGreaterThan(0);
  });

  test('should open department detail on tap', async ({ mobilePage: page }) => {
    await page.waitForTimeout(500);
    const items = page.locator('ion-item, ion-card');
    if (await items.count() === 0) { return; }
    await items.first().click();
    await page.waitForTimeout(800);
    expect(page.url()).not.toContain('/login');
  });
});
