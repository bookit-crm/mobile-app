import { test, expect } from '../fixtures';
import { goTo, openMenu } from '../helpers';

/**
 * Navigation — smoke tests.
 * Verifies every main route renders without crashing.
 */

const ROUTES: { path: string; titleKey: string }[] = [
  { path: 'main/calendar',       titleKey: 'Calendar'       },
  { path: 'main/appointments',   titleKey: 'Appointments'   },
  { path: 'main/clients',        titleKey: 'Clients'        },
  { path: 'main/employees',      titleKey: 'Employees'      },
  { path: 'main/services',       titleKey: 'Services'       },
  { path: 'main/daily-schedule', titleKey: 'Daily Schedule' },
  { path: 'main/dashboard',      titleKey: 'Analytics'      },
  { path: 'main/departments',    titleKey: 'Departments'    },
  { path: 'main/expenses',       titleKey: 'Expenses'       },
  { path: 'main/payroll',        titleKey: 'Payroll'        },
  { path: 'main/products',       titleKey: 'Warehouse'      },
  { path: 'main/promo-codes',    titleKey: 'Promo Codes'    },
  { path: 'main/notification',   titleKey: 'Notifications'  },
  { path: 'main/faq',            titleKey: 'FAQ'            },
  { path: 'main/support',        titleKey: 'Support'        },
];

// In CI the server is slower — give Angular auth guard more time to settle
const NAV_WAIT = process.env['CI'] ? 4_000 : 2_000;
const URL_SETTLE_TIMEOUT = process.env['CI'] ? 10_000 : 5_000;

test.describe('Navigation — all routes load without crash', () => {
  for (const route of ROUTES) {
    test(`should load ${route.titleKey} page`, async ({ mobilePage: page }) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));

      await goTo(page, route.path, NAV_WAIT);

      // Wait for Angular auth guard to finish redirecting (if it will).
      // On CI the guard may run after our fixed wait — actively wait for URL to settle.
      await page.waitForURL(url => !url.includes('/login'), { timeout: URL_SETTLE_TIMEOUT })
        .catch(() => { /* URL check below will catch the actual failure */ });

      // Page must not redirect to login
      expect(page.url()).not.toContain('/login');
      // App root still attached
      await expect(page.locator('ion-app').first()).toBeAttached();
      // No critical JS errors
      const critical = errors.filter(e =>
        !e.includes('favicon') && !e.includes('net::ERR') &&
        !e.includes('WebSocket') && !e.includes('ChunkLoad'),
      );
      expect(critical).toHaveLength(0);
    });
  }

  test('should open side menu from calendar', async ({ mobilePage: page }) => {
    await goTo(page, 'main/calendar', NAV_WAIT);
    await openMenu(page);

    // Menu should show some links
    const menuLinks = page.locator('ion-menu ion-item, ion-menu ion-list-header');
    const count = await menuLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});
