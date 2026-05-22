# Mobile App — E2E Tests

Playwright E2E test suite for the Ionic/Angular mobile app.

## Setup

```bash
npm install        # installs @playwright/test
npx playwright install chromium  # install browser binaries
```

## Running tests

```bash
# Run all tests (requires ng serve on :8100 + core-api on :3000)
npm run e2e

# Run headed (visible browser)
npm run e2e:headed

# Run a specific spec
npx playwright test --config=playwright.config.ts e2e/tests/calendar.spec.ts

# Run only mobile-chrome project
npx playwright test --config=playwright.config.ts --project=mobile-chrome

# Generate HTML report
npm run e2e:report
```

## Prerequisites

| Service | Port |
|---------|------|
| core-api (NestJS) | 3000 |
| mobile-app (ng serve) | 8100 |

The fixture auto-bypasses login by injecting `auth_token` into localStorage.  
API calls to `192.168.1.176:3000` are intercepted and redirected to `localhost:3000`.

## Test structure

```
e2e/
  fixtures.ts        — shared auth fixture + browser context factory
  helpers.ts         — page navigation & Ionic helpers
  tests/
    login.spec.ts          — Login form, validation, successful auth
    navigation.spec.ts     — All 15 routes load without crash + side menu
    calendar.spec.ts       — Day/Week/Month views, filter, FAB, navigation
    appointments.spec.ts   — List, status filter, search, swipe, detail
    clients.spec.ts        — List, search, swipe, detail, filter, FAB
    dashboard.spec.ts      — Analytics title, date presets, KPI cards, charts
    daily-schedule.spec.ts — Title, grid, navigation
    employees.spec.ts      — List, search, detail
    services.spec.ts       — List, search
    departments.spec.ts    — List, detail
    expenses.spec.ts       — List, add button
    payroll.spec.ts        — Title, content, no crash
    products.spec.ts       — List, search
    promo-codes.spec.ts    — List
    notifications.spec.ts  — List, no crash
    static-pages.spec.ts   — FAQ accordion, Support title
```

## Coverage

| Page | Tests |
|------|-------|
| Login | 4 |
| Navigation (15 routes) | 16 |
| Calendar | 10 |
| Appointments | 7 |
| Clients | 7 |
| Dashboard | 6 |
| Daily Schedule | 4 |
| Employees | 4 |
| Services | 3 |
| Departments | 3 |
| Expenses | 3 |
| Payroll | 3 |
| Products | 3 |
| Promo Codes | 2 |
| Notifications | 3 |
| FAQ + Support | 4 |
| **Total** | **168** (2 projects × 84 tests) |
