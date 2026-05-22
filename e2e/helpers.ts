import { Page } from '@playwright/test';

const BASE = 'http://localhost:8100';

/** Navigate to a mobile-app route and wait for it to settle */
export async function goTo(page: Page, route: string, waitMs = 2000): Promise<void> {
  await page.goto(`${BASE}/${route}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForTimeout(waitMs);
}

/** Wait for an ion-title to contain the given text */
export async function waitForTitle(page: Page, text: string): Promise<void> {
  await page.locator('ion-title', { hasText: text }).first().waitFor({ state: 'visible', timeout: 8_000 });
}

/** Get the text of the current ion-title */
export async function getPageTitle(page: Page): Promise<string> {
  return page.locator('ion-title').first().innerText().catch(() => '');
}

/** Fill an ion-input (Ionic shadow DOM) by its label text */
export async function fillIonInput(page: Page, labelText: string, value: string): Promise<void> {
  const field = page.locator(`ion-input:near(label:has-text("${labelText}"))`)
    .or(page.locator('ion-input').filter({ hasText: labelText }))
    .first();
  await field.locator('input').first().fill(value);
}

/** Type into an ion-searchbar */
export async function searchIn(page: Page, query: string): Promise<void> {
  const bar = page.locator('ion-searchbar').first();
  await bar.waitFor({ state: 'visible', timeout: 5_000 });
  await bar.locator('input').fill(query);
  await page.waitForTimeout(600);
}

/** Count ion-card / ion-item rows on current page */
export async function countListItems(page: Page, selector = 'ion-item, ion-card'): Promise<number> {
  return page.locator(selector).count();
}

/** Open the side menu */
export async function openMenu(page: Page): Promise<void> {
  const menuBtn = page.locator('ion-menu-button').first();
  if (await menuBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await menuBtn.click();
    await page.waitForTimeout(400);
  }
}

/** Click a segment button by value */
export async function clickSegment(page: Page, value: string): Promise<void> {
  await page.locator(`ion-segment-button[value="${value}"]`).first().click();
  await page.waitForTimeout(400);
}

/** Check that the page did not crash (no unhandled Angular errors) */
export async function checkNoCrash(page: Page, errors: string[]): Promise<void> {
  const critical = errors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('net::ERR') &&
    !e.includes('ChunkLoadError') &&
    !e.includes('WebSocket') &&
    !e.includes('Socket'),
  );
  if (critical.length > 0) {
    throw new Error(`Page crashed with: ${critical[0]}`);
  }
}
