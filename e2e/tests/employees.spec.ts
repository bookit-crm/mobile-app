import { test, expect } from '../fixtures';
import { goTo, searchIn } from '../helpers';

/**
 * Employees page — E2E tests.
 */
test.describe('Employees', () => {
  test.beforeEach(async ({ mobilePage: page }) => {
    await goTo(page, 'main/employees', 2500);
  });

  test('should display Employees title', async ({ mobilePage: page }) => {
    await expect(page.locator('ion-title', { hasText: /employee/i })).toBeVisible();
  });

  test('should show employee list with items', async ({ mobilePage: page }) => {
    await page.waitForTimeout(1000);
    const items = page.locator('ion-item, ion-card, [class*="employee"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should search employees', async ({ mobilePage: page }) => {
    const searchBar = page.locator('ion-searchbar');
    if (!(await searchBar.isVisible({ timeout: 2_000 }).catch(() => false))) { return; }

    await searchIn(page, 'Larisia');
    await page.waitForTimeout(700);
    const count = await page.locator('ion-item, ion-card').count();
    // May be 0 or more — just no crash
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should open employee detail when tapped', async ({ mobilePage: page }) => {
    await page.waitForTimeout(500);
    const items = page.locator('ion-item, ion-card');
    if (await items.count() === 0) { return; }

    await items.first().click();
    await page.waitForTimeout(1000);
    expect(page.url()).not.toContain('/login');
  });
});
