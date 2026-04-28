# Mobile App — Feature Map

> «Какой сервис/модуль за что отвечает». Держи актуальным — источник экономии токенов: не надо `semantic_search`.

## Статус
⚠️ Репо на старте. Единственная реальная страница — `home`. Ниже — **текущее состояние** + **план** (помечено 🧭).

## Страницы (`src/app/pages/` — пока в `src/app/`)

| Роут | Файл | Назначение | Статус |
|------|------|-----------|--------|
| `/home` | `src/app/home/home.page.ts` | Ionic scaffold-страница | ✅ есть |
| `/login` | `src/app/pages/auth/login.page.ts` | Логин пользователя | 🧭 план |
| `/main/appointments` | `src/app/pages/main/pages/appointments/appointments.page.ts` | Список записей (search + status filter + infinite scroll, create/edit/delete, history nav) | ✅ реализована |
| `/main/appointments/:appointmentId/history` | `src/app/pages/main/pages/appointments/components/appointment-history/appointment-history.page.ts` | История изменений записи (filter by action) | ✅ реализована |
| `/main/departments` | `src/app/pages/main/pages/departments/departments.page.ts` | Каталог департаментов — список с поиском, создание/редактирование/удаление | ✅ реализована |
| `/main/departments/:id` | `src/app/pages/main/pages/departments/pages/department/department.page.ts` | Детальная страница департамента (Overview + Branding + Schedule вкладки) | ✅ реализована |
| `/main/profile` | `src/app/pages/profile/...` | Профиль пользователя | 🧭 план |

## Core сервисы (`src/app/core/services/` — ещё не созданы)

| Сервис | Назначение | Backend эндпоинты | Статус |
|--------|-----------|-------------------|--------|
| `AuthService` | login/logout/refresh, хранение токена | `api/auth/*` | 🧭 |
| `AppointmentsService` | CRUD + paginated list + history записей | `api/appointment/*` | ✅ реализован |
| `DepartmentService` | CRUD департаментов, список, детали, signals | `api/department/*` | ✅ реализован |
| `FilesService` | Загрузка файлов (изображений) на сервер | `api/files/` | ✅ реализован |
| `NotificationsService` | Push + in-app уведомления | `api/notification/*` | 🧭 |
| `WebsocketService` | Socket.io singleton | — | 🧭 |

## Core helpers (`src/app/core/helpers/`)

| Helper | Назначение | Статус |
|--------|-----------|--------|
| `HttpHelper` | Базовый класс HTTP-сервисов (`httpGetRequest` и др.) | 🧭 |
| `ValidatorsHelper` | Кастомные Angular-валидаторы | 🧭 |
| `PlatformHelper` | Обёртки над `Capacitor.getPlatform()` | 🧭 опц. |

## Interceptors (`src/app/core/interceptors/`)

| Interceptor | Назначение | Статус |
|-------------|-----------|--------|
| `BaseUrlInterceptor` | `'api/...' → environment.be_url + 'api/...'` | 🧭 |
| `AuthInterceptor` | `Authorization: Bearer <token>` | 🧭 |
| `ErrorInterceptor` | Toast + редирект 401→/login | 🧭 |

## Guards (`src/app/core/guards/`)

| Guard | Назначение | Статус |
|-------|-----------|--------|
| `authGuard` | Защита приватных роутов | 🧭 |
| `guestGuard` | Не пускает залогиненного на /login | 🧭 опц. |

## Модели (`src/app/core/models/`)

Главное правило: **переиспользуй контракты из `core-api`** (см. `core-api/agents/feature-map.md`). Совпадающие DTO — такие же интерфейсы `IAppointment`, `IDepartment`, `IUser` и т.д.

## Связь с другими репо

| Репо | Что оттуда берём |
|------|-----------------|
| `core-api` | API-контракты, DTO-схемы, WebSocket events |
| `desktop-app-v2` | Референс-реализации `HttpHelper`, interceptors, `AuthService`, `WebsocketService` (адаптировать под Ionic, не копировать Material) |

## Обновление этой карты
После добавления нового page / service / guard — **обнови таблицу** здесь в том же PR. `doc ↔ код` расходятся → **код победил**, но doc чинится сразу.

