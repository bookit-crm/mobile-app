# Mobile App — Feature Map

> «Какой сервис/модуль за что отвечает». Держи актуальным — источник экономии токенов: не надо `semantic_search`.

## Статус
Проект значительно продвинулся. Ниже — **актуальное состояние**.

## Страницы (`src/app/pages/`)

| Роут | Файл | Назначение | Статус |
|------|------|-----------|--------|
| `/login` | `src/app/pages/auth/login/login.page.ts` | Логин пользователя | ✅ реализована |
| `/main/appointments` | `pages/main/pages/appointments/appointments.page.ts` | Список записей (search + status filter + infinite scroll, create/edit/delete, history nav) | ✅ реализована |
| `/main/appointments/:id/history` | `pages/main/pages/appointments/components/appointment-history/...` | История изменений записи | ✅ реализована |
| `/main/calendar` | `pages/main/pages/calendar/calendar.page.ts` | Календарь записей | ✅ реализована |
| `/main/daily-schedule` | `pages/main/pages/daily-schedule/daily-schedule.page.ts` | Расписание за день | ✅ реализована |
| `/main/dashboard` | `pages/main/pages/dashboard/dashboard.page.ts` | Дашборд со статистикой | ✅ реализована |
| `/main/departments` | `pages/main/pages/departments/departments.page.ts` | Каталог департаментов (поиск, CRUD) | ✅ реализована |
| `/main/departments/:id` | `pages/main/pages/departments/pages/department/department.page.ts` | Детальная страница (Overview / Branding / Schedule) | ✅ реализована |
| `/main/employees` | `pages/main/pages/employees/employees.page.ts` | Список сотрудников (CRUD) | ✅ реализована |
| `/main/services` | `pages/main/pages/services/services.page.ts` | Список услуг (CRUD, filter by dept) | ✅ реализована |
| `/main/clients` | `pages/main/pages/clients/clients.page.ts` | Список клиентов (search, filter, swipe, history, new appointment) | ✅ реализована |
| `/main/clients → modal` | `pages/main/pages/clients/pages/client-detail/client-detail.page.ts` | Детали клиента + история (standalone modal) | ✅ реализована |
| `/main/products` | `pages/main/pages/products/products.page.ts` | Склад / товары (feature: warehouse) | ✅ реализована |
| `/main/expenses` | `pages/main/pages/expenses/expenses.page.ts` | Расходы (search, filters, CRUD swipe) | ✅ реализована |
| `/main/payroll` | `pages/main/pages/payroll/payroll.page.ts` | Зарплаты (feature: expensesPayroll) | ✅ реализована |
| `/main/promo-codes` | `pages/main/pages/promo-codes/promo-codes.page.ts` | Промо-коды (search + visibility/date filters, CRUD swipe, form-modal с services & discounts, feature: promoCodes) | ✅ реализована |
| `/main/notification` | `pages/main/pages/notification/notification.page.ts` | Уведомления | ✅ реализована |
| `/main/faq` | `pages/main/pages/faq/faq.page.ts` | FAQ | ✅ реализована |

## Core сервисы (`src/app/core/services/`)

| Сервис | Назначение | Backend эндпоинты | Статус |
|--------|-----------|-------------------|--------|
| `AuthService` | login/logout/refresh, хранение токена | `api/auth/*` | ✅ реализован |
| `SupervisorService` | self/getSelf, менеджеры CRUD, `singleDepartmentMode`, `effectiveDepartmentId` | `api/supervisor/*` | ✅ реализован |
| `SubscriptionService` | Подписка, `hasFeature()`, `meetsTier()`, `isActive()`, `isSingleLocationPlan()` | `api/subscription/self/` | ✅ реализован |
| `AppointmentsService` | CRUD + paginated list + history | `api/appointment/*` | ✅ реализован |
| `ClientsService` | CRUD, список, `getClientAppointments`, importExcel | `api/client/*` | ✅ реализован |
| `DepartmentService` | CRUD, список, сигналы (`departmentsSignal`, `currentDepartmentSignal`, `singleDepartmentSignal`) | `api/department/*` | ✅ реализован |
| `EmployeeService` | CRUD сотрудников | `api/employee/*` | ✅ реализован |
| `ServicesService` | CRUD услуг, `getServices({ departmentId })` | `api/service/*` | ✅ реализован |
| `SchedulesService` | Расписание (работы сотрудников / департамента) | `api/schedule/*` | ✅ реализован |
| `DashboardService` | Статистика для дашборда | `api/dashboard/*` | ✅ реализован |
| `ExpensesService` | CRUD расходов, paginated list | `api/expense/*` | ✅ реализован |
| `PayrollService` | Расчёт зарплат | `api/payroll/*` | ✅ реализован |
| `ProductsService` | Склад / товары | `api/product/*` | ✅ реализован |
| `PromoCodesService` | CRUD промо-кодов, `toggleVisibility`, `getActiveForDepartment` | `api/promo-code/*` | ✅ реализован |
| `FilesService` | Загрузка изображений | `api/files/` | ✅ реализован |
| `LoaderService` | Глобальный индикатор загрузки | — | ✅ реализован |

## Core helpers (`src/app/core/helpers/`)

| Helper | Назначение | Статус |
|--------|-----------|--------|
| `HttpHelper` | Базовый класс HTTP-сервисов (`httpGetRequest`, `httpPostRequest`, `httpPatchRequest`, `httpDeleteRequest`) | ✅ реализован |

## Interceptors (`src/app/core/interceptors/`)

| Interceptor | Назначение | Статус |
|-------------|-----------|--------|
| `BaseUrlInterceptor` | `'api/...' → environment.be_url + 'api/...'` | ✅ реализован |
| `AuthInterceptor` | `Authorization: Bearer <token>` | ✅ реализован |
| `ErrorInterceptor` | Toast на ошибки + редирект 401→/login | ✅ реализован |

## Guards (`src/app/core/guards/`)

| Guard | Назначение | Статус |
|-------|-----------|--------|
| `authGuard` | Защита приватных роутов | ✅ реализован |
| `guestGuard` | Не пускает залогиненного на /login | ✅ реализован |

## Shared компоненты (`src/app/core/components/`)

| Компонент | Назначение | Статус |
|-----------|-----------|--------|
| `SideMenuComponent` | Боковое меню с feature-gate фильтрацией пунктов | ✅ реализован |

## Enums (`src/app/core/enums/`)

| Enum | Назначение | Статус |
|------|-----------|--------|
| `EUserRole` | `ADMIN`, `MANAGER` | ✅ |
| `ELocalStorageKeys` | Ключи localStorage | ✅ |
| `ESalaryRateType` | `fixed`, `commission`, `fixed_plus_commission`, `base_or_commission` | ✅ |

## Модели (`src/app/core/models/`)

Главное правило: **переиспользуй контракты из `core-api`**. Совпадающие DTO — такие же интерфейсы `IAppointment`, `IDepartment`, `IUser`, `IPromoCode` и т.д.

## Связь с другими репо

| Репо | Что оттуда берём |
|------|-----------------|
| `core-api` | API-контракты, DTO-схемы, WebSocket events |
| `desktop-app-v2` | Референс-реализации `HttpHelper`, interceptors, `AuthService` (адаптировать под Ionic, не копировать Material) |

## Обновление этой карты
После добавления нового page / service / guard — **обнови таблицу** здесь в том же PR. `doc ↔ код` расходятся → **код победил**, но doc чинится сразу.
