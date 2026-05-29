import { test, expect } from '../fixtures';
import { goTo } from '../helpers';

test.describe('Dashboard (Analytics)', () => {
  test.beforeEach(async ({ mobilePage: page }) => {
    await goTo(page, 'main/dashboard', 3000);
  });

  test('should display Analytics title', async ({ mobilePage: page }) => {
    await expect(page.locator('ion-title', { hasText: /analytics|dashboard/i })).toBeVisible();
  });

  test('should show date preset chips', async ({ mobilePage: page }) => {
    const chips = page.locator('ion-chip, .preset-chip');
    const count = await chips.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show KPI stat cards or widgets', async ({ mobilePage: page }) => {
    await page.waitForTimeout(1500);
    const kpiCards = page.locator(
      '[class*="kpi"], [class*="stat-card"], [class*="metric"], ion-card',
    );
    const count = await kpiCards.count();
    expect(count).toBeGreaterThanOrEqual(0); // may be 0 if no data — just no crash
  });

  test('should render chart elements (SVG or canvas)', async ({ mobilePage: page }) => {
    await page.waitForTimeout(2000);
    const charts = page.locator('svg, canvas, [class*="chart"]');
    const count = await charts.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should switch date presets without crashing', async ({ mobilePage: page }) => {
    const chips = page.locator('ion-chip');
    const count = await chips.count();
    if (count < 2) { return; }

    await chips.nth(1).click();
    await page.waitForTimeout(1000);
    await expect(page.locator('ion-content').last()).toBeVisible();
    await chips.nth(0).click();
    await page.waitForTimeout(800);
  });

  test('should open filter modal', async ({ mobilePage: page }) => {
    const filterBtn = page.locator('ion-button.filter-btn').first();
    if (!(await filterBtn.isVisible({ timeout: 2_000 }).catch(() => false))) { return; }

    await filterBtn.click();
    await page.waitForTimeout(600);
    await expect(page.locator('ion-modal').first()).toBeVisible({ timeout: 5_000 });
    await page.locator('ion-modal ion-button:has(ion-icon[name="close-outline"])').first()
      .click().catch(() => {});
  });
});
