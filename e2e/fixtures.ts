import { test as base, BrowserContext, Page } from '@playwright/test';
import * as http from 'http';

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
      rs => {
        let s = '';
        rs.on('data', c => (s += c));
        rs.on('end', () => {
          try { res(JSON.parse(s)); } catch { res({}); }
        });
      },
    );
    r.on('error', rej); r.write(d); r.end();
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── JWT cache (one login per test-file run) ─────────────────────────────────

let _cachedJwt: string | null = null;

/**
 * Obtain a valid JWT by calling activate → login.
 * Retries 3 times with 3 s delay — needed in CI where the API may not be
 * fully ready (DB connection) right after the HTTP health-check passes.
 */
async function getJwt(): Promise<string> {
  if (_cachedJwt) return _cachedJwt;

  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const cfg = await apiPost('/api/desktop/activate', { email: EMAIL, password: PASSWORD });
      if (!cfg?.database_id) {
        throw new Error(`activate returned no database_id (attempt ${attempt}): ${JSON.stringify(cfg)}`);
      }

      const tok = await apiPost('/api/auth/login', {
        email: EMAIL, password: PASSWORD, dataBaseId: cfg.database_id,
      });
      if (!tok?.auth_token || typeof tok.auth_token !== 'string') {
        throw new Error(`login returned no auth_token (attempt ${attempt}): ${JSON.stringify(tok)}`);
      }

      _cachedJwt = tok.auth_token;
      console.log(`[fixtures] JWT obtained on attempt ${attempt}`);
      return _cachedJwt;
    } catch (e: any) {
      lastError = e?.message ?? String(e);
      console.warn(`[fixtures] JWT attempt ${attempt} failed: ${lastError}`);
      if (attempt < 3) await sleep(3_000);
    }
  }

  throw new Error(`[fixtures] Could not obtain JWT after 3 attempts. Last error: ${lastError}`);
}

// ── Enterprise subscription mock ───────────────────────────────────────────
//
// The test account on CI may have a limited (Individual / Starter) plan.
// Pages like Expenses, Payroll, Products and Promo Codes check the
// subscription tier and show a locked screen if the feature is unavailable.
// To avoid that we intercept api/subscription/self/ and always return a
// full Enterprise subscription — the real auth flow is unchanged.

const ENTERPRISE_SUBSCRIPTION = {
  _id:  'e2e-test-subscription',
  companyId: 'e2e-test-company',
  tier: 'enterprise',
  employeeLimit: -1,
  locationLimit: -1,
  features: {
    warehouse:                   'advanced',
    analytics:                   'advanced',
    desktopApp:                  'full',
    marketing:                   'full',
    apiAccess:                   'full',
    telegramBot:                 true,
    promoCodes:                  true,
    expensesPayroll:             'full',
    notifications:               'full',
    notificationsScope:          'full',
    prioritySupport:             true,
    sso:                         true,
    auditLogs:                   true,
    storageMb:                   -1,
    productsImport:              true,
    productsHistory:             true,
    productsAttachToService:     true,
    productsAttachToAppointment: true,
    productsStockAlerts:         true,
  },
  stripeCustomerId:     null,
  stripeSubscriptionId: null,
  stripePriceId:        null,
  status:               'active',
  currentPeriodStart:   '2025-01-01T00:00:00.000Z',
  currentPeriodEnd:     '2030-12-31T23:59:59.000Z',
  cancelAtPeriodEnd:    false,
  trialEnd:             null,
  storage: {
    usedBytes:  0,
    limitBytes: -1,
    usedMb:     0,
    limitMb:    -1,
    percent:    0,
    unlimited:  true,
  },
};

// ── Mobile context factory ──────────────────────────────────────────────────

/**
 * Creates a BrowserContext pre-configured for the mobile app:
 *   - iPhone 14 Pro viewport
 *   - Redirects API calls from 192.168.1.176:3000 → localhost:3000
 *   - Intercepts api/subscription/self/ and returns Enterprise mock
 *   - Injects JWT + language into localStorage before any page loads
 */
export async function createMobileContext(browser: any): Promise<{ context: BrowserContext; jwt: string }> {
  const jwt = await getJwt();

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  });

  // Redirect all API calls from the hardcoded dev IP to localhost.
  // Registered first so the subscription mock (registered next) takes
  // priority in Playwright's LIFO route-matching order.
  await context.route(`**://${API_ORIGIN}/**`, route =>
    route.continue({ url: route.request().url().replace(API_ORIGIN, 'localhost:3000') }),
  );

  // Mock subscription endpoint — always returns Enterprise tier.
  // Registered after origin rewrite → checked first (LIFO) → short-circuits
  // before any network request is made, so the real plan doesn't matter.
  await context.route(
    url => url.href.includes('/api/subscription'),
    route => route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify(ENTERPRISE_SUBSCRIPTION),
    }),
  );

  // Inject auth token + English language on every page load.
  // Multiple keys cover different Angular i18n library conventions.
  await context.addInitScript((token: string) => {
    localStorage.setItem('auth_token', token);
    // Language keys — set all common variants so the app renders in English
    localStorage.setItem('language',         'en');
    localStorage.setItem('lang',             'en');
    localStorage.setItem('selectedLanguage', 'en');
    localStorage.setItem('locale',           'en');
    localStorage.setItem('i18n_language',    'en');
    localStorage.setItem('currentLanguage',  'en');
    localStorage.setItem('appLanguage',      'en');
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
    // Start on calendar (default route after login).
    // In CI the server is slower — give Angular more time to bootstrap.
    // Wait for Angular to hydrate. In CI the server is slower but we keep
    // this short — per-test timeouts (60 s) absorb any extra latency.
    await page.goto(`${MOBILE_BASE}/main/calendar`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(process.env['CI'] ? 2_000 : 1_500);
    await use(page);
    await context.close();
  },
  jwt: async ({}, use) => {
    const token = await getJwt();
    await use(token);
  },
});

export { expect } from '@playwright/test';
