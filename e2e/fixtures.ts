import { test as base, BrowserContext, Page } from '@playwright/test';
import * as http from 'http';

const API_BASE     = 'http://localhost:3000';
const MOBILE_BASE  = 'http://localhost:8100';
const EMAIL        = process.env['E2E_EMAIL']    ?? 'mabego8870@pmdeal.com';
const PASSWORD     = process.env['E2E_PASSWORD'] ?? 'asdASD123!@#';
const API_ORIGIN   = '192.168.1.176:3000';   // hardcoded in environment.ts

// ── HTTP helper (Node — no browser needed) ─────────────────────────────────

function apiPost(path: string, body: object): Promise<any> {
  return new Promise((res, rej) => {
    const d = JSON.stringify(body);
    const r = http.request(
      {
        hostname: 'localhost', port: 3000, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) },
      },
      rs => { let s = ''; rs.on('data', c => (s += c)); rs.on('end', () => res(JSON.parse(s))); },
    );
    r.on('error', rej); r.write(d); r.end();
  });
}

// ── JWT cache (one login per test-file run) ─────────────────────────────────

let _cachedJwt: string | null = null;

async function getJwt(): Promise<string> {
  if (_cachedJwt) return _cachedJwt;
  const cfg = await apiPost('/api/desktop/activate', { email: EMAIL, password: PASSWORD });
  const tok = await apiPost('/api/auth/login', {
    email: EMAIL, password: PASSWORD, dataBaseId: cfg.database_id,
  });
  _cachedJwt = tok.auth_token as string;
  return _cachedJwt!;
}

// ── Mobile context factory ──────────────────────────────────────────────────

/**
 * Creates a BrowserContext pre-configured for the mobile app:
 *   - iPhone 14 Pro viewport
 *   - Redirects API calls from 192.168.1.176:3000 → localhost:3000
 *   - Injects JWT into localStorage before any page loads
 */
export async function createMobileContext(browser: any): Promise<{ context: BrowserContext; jwt: string }> {
  const jwt = await getJwt();

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  });

  // Redirect all API calls from the hardcoded dev IP to localhost
  await context.route(`**://${API_ORIGIN}/**`, route =>
    route.continue({ url: route.request().url().replace(API_ORIGIN, 'localhost:3000') }),
  );

  // Inject auth token and language on every page load
  await context.addInitScript((token: string) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('language', 'en');
  }, jwt);

  return { context, jwt };
}

// ── Shared page helper ──────────────────────────────────────────────────────

export async function openPage(page: Page, route: string): Promise<void> {
  await page.goto(`${MOBILE_BASE}/${route}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForTimeout(2_000);
}

// ── Custom fixture type ─────────────────────────────────────────────────────

type MobileFixtures = {
  /** Authenticated Ionic page — ready to use without login flow */
  mobilePage: Page;
  jwt: string;
};

export const test = base.extend<MobileFixtures>({
  mobilePage: async ({ browser }, use) => {
    const { context } = await createMobileContext(browser);
    const page = await context.newPage();
    // Start on calendar (default route after login)
    await page.goto(`${MOBILE_BASE}/main/calendar`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForTimeout(3_000);
    await use(page);
    await context.close();
  },
  jwt: async ({}, use) => {
    const token = await getJwt();
    await use(token);
  },
});

export { expect } from '@playwright/test';
