# Mobile App — Agent Docs Router

> **Назначение:** карта «какая задача → какие файлы читать», чтобы не грузить всё подряд.

## Token-saving правило №1
Сначала смотри **этот файл** и `agent-skills.md`. Только потом — конкретный документ из таблицы.

## Файлы в `agents/`
| Файл | Когда читать |
|------|--------------|
| `README.md` (этот) | Всегда первым |
| `agent-skills.md` | Перед любой правкой Angular/Ionic кода — антипаттерны, рецепты, импорты |
| `architecture.md` | Только если нужен контекст Ionic / Capacitor / HTTP / routing / auth |
| `conventions.md` | При создании нового page/service/component — naming + шаблоны |
| `feature-map.md` | «Какой сервис/модуль за что отвечает» (чтобы не делать `semantic_search`) |

## Маршрутизация по типам задач

| Задача | Читай | НЕ читай |
|--------|-------|----------|
| Новая страница (lazy page) | `conventions.md` § Структура page + `agent-skills.md` § Page template | architecture |
| Новый HTTP-сервис | `agent-skills.md` § HttpHelper + `feature-map.md` (соседний сервис как образец) | architecture, conventions |
| Новый shared компонент | `conventions.md` § shared-компонент + `agent-skills.md` § component | feature-map |
| Изменение routing / guards | `architecture.md` § Routing | feature-map |
| Capacitor плагин / native API | `architecture.md` § Capacitor + `capacitor.config.ts` | feature-map |
| HTTP interceptors / auth | `architecture.md` § HTTP + `agent-skills.md` § HttpHelper | conventions |
| Forms / валидация | `agent-skills.md` § forms | docs не нужны |
| Работа с backend (API контракт) | `../../core-api/agents/README.md` (соседний репо) | всё mobile |

## Source-of-truth
Если doc ↔ код расходятся — **код победил**. Сразу обнови doc после правки кода.

## Статус проекта
⚠️ Mobile app сейчас в **начальной стадии**: только scaffolding Ionic + home-страница. Большинство паттернов (HttpHelper, auth, interceptors, i18n) ещё **не реализованы** — их нужно создавать по мере роста, опираясь на proven-решения из `desktop-app-v2` (не копируй Material/Electron код — адаптируй под Ionic/Capacitor).

