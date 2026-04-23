# Mobile App — Architecture

> Читай **только** при работе с инфраструктурой: Ionic bootstrap, Capacitor, HTTP-слой, routing, auth. Для обычной feature-работы достаточно `agent-skills.md` + `conventions.md`.

## Stack
- **Angular 20** (standalone-first, Signals, Zone.js 0.15)
- **Ionic 8** (`@ionic/angular`) — UI kit и navigation helpers
- **Capacitor 6** — bridge к native Android/iOS
- **TypeScript 5.8**, `strict: true`

## Entry & Bootstrap
- `src/main.ts` → `platformBrowserDynamic().bootstrapModule(AppModule)`
- `src/app/app.module.ts`: `IonicModule.forRoot()`, `RouteReuseStrategy = IonicRouteStrategy` (обязательно для Ionic-анимаций).
- `src/app/app.component.ts` — корневой компонент, оборачивает `<ion-app><ion-router-outlet /></ion-app>`.

## Routing
- `app-routing.module.ts` — корень. `PreloadAllModules` для preload lazy-модулей.
- **Lazy** через `loadChildren` (module-based) или `loadComponent` (standalone).
- Обычный `PathLocationStrategy` (default). Не подключай `HashLocationStrategy`.
- Для нативных push/pop-анимаций используй `NavController.navigateForward/Back/Root`, а не напрямую `Router.navigate`.
- Guards размещай в `src/app/core/guards/`.

## HTTP-слой (рекомендуемая архитектура, когда будет внедрена)
1. **`environment.be_url`** — базовый URL API (`https://api.bookit.app/` или dev-proxy).
2. **`HttpHelper`** (`src/app/core/helpers/http-helper.ts`) — базовый класс для сервисов:
   - `httpGetRequest<T>(url, params?)`, `httpPostRequest`, `httpPatchRequest`, `httpDeleteRequest`.
   - Наследники вызывают `httpGetRequest('api/feature')`.
3. **Base-URL interceptor** — подменяет любой URL, начинающийся с `'api/'`, на `environment.be_url + 'api/...'`.
4. **Auth interceptor** — добавляет `Authorization: Bearer <token>` из storage (см. ниже).
5. **Error interceptor** — централизованный `ion-toast` + редирект на login при 401.

> Паттерн полностью зеркалит `desktop-app-v2`. Копируй идеи, но **не** Material-нотификации — заменяй на `ToastController`.

## Storage / сессия
- **Token, user profile** → `@capacitor/preferences` (native-safe) или `@ionic/storage-angular` (если нужна крупная реляционная структура).
- Ключи — enum в `src/app/core/enums/storage-keys.enum.ts` (по образцу `ELocalStorageKeys` из desktop).

## Auth flow (планируемый)
1. `LoginPage` → `AuthService.login()` → POST `api/auth/login` → токен в storage.
2. `authGuard` в защищённых lazy-routes.
3. Logout → `storage.clear()` + `NavController.navigateRoot('/login')`.
4. Refresh token — см. `core-api/agents` (эндпоинт `api/auth/refresh`).

## Capacitor
- Конфиг: `capacitor.config.ts` (`appId: com.bookit.mobile`, `webDir: www`, `androidScheme: https`).
- Android: `android/`, iOS: `ios/`.
- **Flow разработки**:
  - Браузер-dev: `ng serve` — без нативных плагинов.
  - Live-reload на устройстве: `ionic cap run android --livereload --external`.
  - Production: `npm run build && npx cap sync <platform> && npx cap open <platform>`.
- Нативный плагин недоступен на web → guard `Capacitor.isNativePlatform()` или `Capacitor.isPluginAvailable('Name')`.
- Подключённые плагины: `@capacitor/app`, `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/status-bar`.

## WebSocket (план)
Бэкенд шлёт события через `socket.io` (см. `core-api/agents/architecture.md` § WebSocket). На мобиле:
- Один singleton `WebsocketService` (аналог desktop-а).
- Подключение инициировать **после** login, отключать на logout.
- Реактив — Signal-based: `ws.newNotificationSignal`.

## i18n (план)
- `@ngx-translate/core` + `@ngx-translate/http-loader` (как в desktop).
- Файлы `src/assets/i18n/{en,ru,...}.json`.
- Язык по умолчанию — `Device.getLanguageCode()` из `@capacitor/device`.

## Build / output
- `ng build` → `www/` (совпадает с `webDir` в `capacitor.config.ts`).
- После build **обязательно** `npx cap sync` для копирования web-артефактов в нативные проекты.

## Платформенные нюансы
- **Safe Area**: используй Ionic CSS переменные `--ion-safe-area-top/bottom`.
- **Status bar**: `StatusBar.setStyle({ style: Style.Light })` при старте приложения.
- **Back button (Android)**: `App.addListener('backButton', ...)` или `Platform.backButton.subscribeWithPriority(...)`.
- **Keyboard**: `Keyboard.setResizeMode({ mode: KeyboardResize.Body })` — чтобы input не уезжал под клавиатуру.

