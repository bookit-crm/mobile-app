import { test, expect } from '../fixtures';
import { goTo } from '../helpers';

test.describe('Payroll', () => {
  test.beforeEach(async ({ mobilePage: page }) => {
    await goTo(page, 'main/payroll', 2500);
  });

  test('should display Payroll title', async ({ mobilePage: page }) => {
    await expect(page.locator('ion-title', { hasText: /payroll/i })).toBeVisible();
  });

  test('should render payroll content or empty state', async ({ mobilePage: page }) => {
    await page.waitForTimeout(1500);
    await expect(page.locator('ion-content')).toBeVisible();
  });

  test('should not crash on load', async ({ mobilePage: page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await goTo(page, 'main/payroll', 2000);
    const critical = errors.filter(e => !e.includes('WebSocket') && !e.includes('favicon'));
    expect(critical).toHaveLength(0);
  });
});
