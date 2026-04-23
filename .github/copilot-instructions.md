# Copilot Instructions — Mobile App

Ты работаешь с проектом **Bookit Mobile App** — Ionic 8 + Angular 20 + Capacitor 6 приложение (Android / iOS) для клиентской части экосистемы Bookit.

## Контекст проекта
Перед началом работы **обязательно**:
1. Прочитай `agents/README.md` — router «задача → какие doc-файлы нужны». Не грузи всё подряд.
2. Прочитай `agents/agent-skills.md` — антипаттерны, шаблоны, чеклисты, типичные баги.
3. Дальше — **только** то, что указал router, из:
   - `agents/architecture.md` — Ionic / Capacitor / routing / HTTP / auth
   - `agents/conventions.md` — code style, naming, шаблоны страниц
   - `agents/feature-map.md` — карта страниц, сервисов, моделей

> **Source-of-truth:** если doc ↔ код расходятся — победил код. Сразу обнови doc.

## Критически важно
1. **Stack**: Ionic 8 (`@ionic/angular`), Angular 20, Capacitor 6, standalone-компоненты предпочтительны.
2. **HTTP API**: бэкенд общий с desktop-app — `core-api` (NestJS, multi-tenant). URL-ы всегда `'api/...'`, базовый URL — из `environment.be_url`.
3. **Routing**: lazy-loaded страницы через `loadChildren`, `PreloadAllModules`. Обычный `PathLocationStrategy` (в мобильном не нужен hash).
4. **Signals**: используй Angular Signals (`signal()`, `computed()`, `effect()`) для локального стейта. `BehaviorSubject` — только если реально нужен Rx stream.
5. **UI**: только Ionic-компоненты (`ion-*`), не Angular Material. Иконки — `ionicons`.
6. **Native API**: через плагины Capacitor (`@capacitor/app`, `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/status-bar`). Не дергай Android/iOS напрямую.
7. **Strict mode**: `strict: true`, `strictTemplates: true`, `noPropertyAccessFromIndexSignature: true` — пиши типобезопасно.

## При генерации кода
- Следуй паттерну из `agents/conventions.md`.
- Новые страницы → lazy-loaded module/standalone page в `src/app/pages/<feature>/`, маршрут в `app-routing.module.ts`.
- Новые shared компоненты → `src/app/core/components/`, `standalone: true`, `ChangeDetectionStrategy.OnPush`.
- HTTP-сервисы → `src/app/core/services/`, наследуй `HttpHelper` (создай если ещё нет — см. `agents/agent-skills.md`).
- Модели/интерфейсы → `src/app/core/models/`, префикс `I`.
- Environment → `src/environments/environment.ts` (+ `.prod.ts`), `be_url` обязательно.
- Platform-specific логика → изолируй в сервисе через `Platform` из `@ionic/angular` или `Capacitor.getPlatform()`.

