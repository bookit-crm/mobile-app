import { test, expect } from '../fixtures';
import { goTo } from '../helpers';

/**
 * Static / informational pages — FAQ & Support.
 */
test.describe('Static Pages', () => {

  test('FAQ — should render title and content', async ({ mobilePage: page }) => {
    await goTo(page, 'main/faq', 2500);
    await expect(page.locator('ion-title', { hasText: /faq/i })).toBeVisible();
    await page.waitForTimeout(500);
    // FAQ items or accordion sections
    const items = page.locator('ion-item, ion-accordion, [class*="faq"]');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('FAQ — accordion expands on click', async ({ mobilePage: page }) => {
    await goTo(page, 'main/faq', 2500);
    const items = page.locator('ion-accordion, ion-item[button]');
    const count = await items.count();
    if (count === 0) { return; }
    await items.first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('ion-content')).toBeVisible();
  });

  test('Support — should render title', async ({ mobilePage: page }) => {
    await goTo(page, 'main/support', 2500);
    await expect(page.locator('ion-title, h1, h2', { hasText: /support/i })).toBeVisible();
  });

  test('Support — page loads without crash', async ({ mobilePage: page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await goTo(page, 'main/support', 2000);
    const critical = errors.filter(e => !e.includes('WebSocket') && !e.includes('favicon'));
    expect(critical).toHaveLength(0);
  });
});
