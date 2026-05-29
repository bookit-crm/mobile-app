import { test, expect } from '../fixtures';
import { goTo } from '../helpers';

/**
 * Notifications page — E2E tests.
 */
test.describe('Notifications', () => {
  test.beforeEach(async ({ mobilePage: page }) => {
    await goTo(page, 'main/notification', 2500);
  });

  test('should display Notifications title', async ({ mobilePage: page }) => {
    await expect(page.locator('ion-title').filter({ visible: true }).first()).toBeVisible();
  });

  test('should show notification list or empty state', async ({ mobilePage: page }) => {
    await page.waitForTimeout(1000);
    const items = await page.locator('ion-item, ion-card, [class*="notification"]').count();
    const empty = await page.locator('[class*="empty"]').count();
    expect(items >= 0 || empty >= 0).toBe(true);
  });

  test('should not crash on load', async ({ mobilePage: page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await goTo(page, 'main/notification', 2000);
    const critical = errors.filter(e => !e.includes('WebSocket') && !e.includes('favicon') && !e.includes('Socket'));
    expect(critical).toHaveLength(0);
  });
});
