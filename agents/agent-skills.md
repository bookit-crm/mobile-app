# Mobile App — Agent Skills & Anti-patterns

> Плотный cheat-sheet. Цель — избежать повторных ошибок и сэкономить токены.

## ⛔ Топ-8 антипаттернов (НЕ делай так)

1. **❌ Хардкод полного URL в HTTP-сервисе**
   ```ts
   // ❌
   this.http.get('http://localhost:3000/api/items');
   // ✅ — interceptor/HttpHelper подставит environment.be_url
   this.httpGetRequest<T>('api/items');
   ```

2. **❌ Не наследовать `HttpHelper`** в HTTP-сервисе → потеряешь `Authorization` / единый error-handling.

3. **❌ Использовать Angular Material / `MatXxxModule`** — в Ionic UI-библиотека **только `@ionic/angular`** (`IonicModule` или standalone `Ion*` импорты из `@ionic/angular/standalone`).

4. **❌ Прямой вызов Android/iOS API** → используй Capacitor-плагин. Нет плагина — обёртывай через custom plugin, не через `window`-хаки.

5. **❌ `BehaviorSubject` для нового локального стейта** — используй `signal()` (Angular 20 style).

6. **❌ Забыть зарегистрировать lazy-route** в `app-routing.module.ts`.

7. **❌ Положить секреты / API-ключи в `environment.ts`** — это bundle, попадёт в APK/IPA. Секреты — на backend.

8. **❌ Блокирующий `alert()` / `confirm()`** — используй `IonAlertController`, `IonToastController`, `IonActionSheetController`.

## ✅ HTTP-сервис — каноничный шаблон

> `HttpHelper` в mobile-app ещё нет — при первой необходимости создай в `src/app/core/helpers/http-helper.ts` (перенеси идею из `desktop-app-v2`: базовый класс с `httpGetRequest/Post/Patch/Delete`, auth-header из `Storage`, префикс `be_url`).

```ts
@Injectable({ providedIn: 'root' })
export class FeatureService extends HttpHelper {
  list(q: { search?: string }): Observable<IPaginatedResponse<IFeature>> {
    return this.httpGetRequest('api/feature', q);
  }
  create(payload: ICreateFeature): Observable<{ message: string }> {
    return this.httpPostRequest('api/feature', payload);
  }
}
```

## ✅ Page (standalone) с Signals — шаблон

```ts
@Component({
  selector: 'app-feature',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feature.page.html',
  styleUrls: ['./feature.page.scss'],
})
export class FeaturePage {
  private readonly service = inject(FeatureService);
  items = signal<IFeature[]>([]);
  search = signal('');
  filtered = computed(() =>
    this.items().filter((i) => i.name.includes(this.search()))
  );

  ngOnInit(): void {
    this.service.list({}).subscribe((res) => this.items.set(res.results));
  }
}
```

## ✅ Lazy-route — шаблон (`app-routing.module.ts`)
```ts
{
  path: 'feature',
  loadChildren: () =>
    import('./pages/feature/feature.module').then((m) => m.FeaturePageModule),
  // или для standalone:
  // loadComponent: () => import('./pages/feature/feature.page').then(m => m.FeaturePage),
}
```

## 🔑 Ключевые импорты
```ts
import { IonicModule, Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
```

## 🔥 Forms
- **Reactive Forms** предпочтительно. Template-driven — только для очень простых форм.
- Кастомные валидаторы — `core/helpers/validators.helper.ts`.
- Сообщения об ошибках — через `<ion-note color="danger">` или `<ion-text>`.

## 🔥 Capacitor — проверка платформы
```ts
if (Capacitor.isNativePlatform()) { /* только нативно */ }
if (Capacitor.getPlatform() === 'ios') { /* iOS-specific */ }
// или через Ionic Platform:
this.platform.is('hybrid'); // true на реальном устройстве
```
Новый плагин: `npm i @capacitor/<name>` → `npx cap sync` → импортируй в сервисе.

## 🔥 Storage (токен, сессия)
- **Не** `localStorage` на native (ненадёжно, iOS может чистить). Используй `@capacitor/preferences` или `@ionic/storage-angular`.
- Если ещё нет — добавь пакет первым при реализации auth.

## 🔥 HTTP на native
⚠️ На native Android/iOS `HttpClient` через WebView может упереться в CORS / mixed content / cookies. Если появятся проблемы — используй `@capacitor/http` или `@awesome-cordova-plugins/http`. Пока — стандартный `HttpClient`.

## 🔥 Routing
- Обычный `PathLocationStrategy` (default). Hash **не нужен** — в native WebView корень контролируется Capacitor.
- `NavController` из Ionic для push/pop с нативными анимациями, когда нужен стек страниц (не простой `Router.navigate`).

## 🛠 Отладка / частые баги
| Симптом | Корень |
|---------|--------|
| `CORS` в dev-browser | бэкенд не разрешает origin — запускай через `ionic cap run android --livereload --external` или настраивай proxy |
| Белый экран в APK | `webDir` в `capacitor.config.ts` не совпадает с Angular `outputPath` (должно быть `www`) |
| Splash/status-bar съезжает | забыл `SafeArea` / `StatusBar.setOverlaysWebView` |
| `Capacitor plugin "X" not implemented on web` | плагин нативный — оберни `if (Capacitor.isNativePlatform())` |
| Lazy-route 404 | путь не зарегистрирован в `app-routing.module.ts` |
| `HttpClient` 404 на native | URL относительный без base — используй полный `environment.be_url` |

## 📋 Чеклист новой страницы
- [ ] Папка `src/app/pages/<feature>/` со стандартным набором файлов (`*.page.ts/.html/.scss/.module.ts/.routing.ts` либо standalone)
- [ ] Маршрут добавлен в `app-routing.module.ts`
- [ ] Использует `IonicModule` / standalone `Ion*`, не Material
- [ ] `ChangeDetectionStrategy.OnPush`
- [ ] HTTP-сервис в `core/services/`, наследует `HttpHelper`, URL с `'api/'`
- [ ] Модели в `core/models/<feature>.interface.ts` с префиксом `I`
- [ ] Signals для локального state, RxJS для HTTP
- [ ] Protected route → добавлен guard (`authGuard`)
- [ ] На native-specific — `Capacitor.isNativePlatform()` guard

## 📋 Чеклист нового shared-компонента
- [ ] Папка `core/components/<name>/`
- [ ] `standalone: true`
- [ ] Inputs/Outputs с явными типами (`input<T>()`, `output<T>()` — Angular 20 signal-based API если возможно)
- [ ] `ChangeDetectionStrategy.OnPush`
- [ ] Использует только `IonicModule` из UI-зависимостей

## 🧠 Token-saving стратегия
1. `agents/README.md` → этот файл — **всегда** первыми.
2. Не читай `desktop-app-v2` код без острой нужды — там Material/Electron, другой UI-слой.
3. Имена сервисов/моделей бери из `feature-map.md` без `semantic_search`.
4. `architecture.md` нужен **редко** — только при изменениях инфраструктуры (interceptors, routing, capacitor).
5. Когда добавляешь то, чего в mobile ещё нет (HttpHelper, interceptor, i18n) — посмотри аналог в `desktop-app-v2/src/app/core/` как reference, но адаптируй под Ionic.

