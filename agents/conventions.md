# Mobile App — Conventions

> Code style, naming, шаблоны. Читай при создании нового page / service / component.

## Структура проекта (целевая)
```
src/app/
├── app.module.ts
├── app-routing.module.ts
├── app.component.{ts,html,scss}
├── core/
│   ├── components/         # shared standalone UI-компоненты
│   ├── guards/             # authGuard, roleGuard, ...
│   ├── helpers/            # HttpHelper, validators, date-helpers
│   ├── interceptors/       # base-url, auth, error
│   ├── enums/              # StorageKeys, UserRole, ...
│   ├── models/             # IFeature, IUser, IAppointment (префикс I)
│   └── services/           # HTTP-сервисы, AuthService, WebsocketService
└── pages/
    └── <feature>/
        ├── <feature>.page.ts
        ├── <feature>.page.html
        ├── <feature>.page.scss
        ├── <feature>.module.ts          # если не standalone
        └── <feature>-routing.module.ts  # если не standalone
```

Сейчас в репо только `src/app/home/` (scaffold Ionic). `core/` и `pages/` создаёшь **лениво** — по первой необходимости.

## Naming
| Сущность | Шаблон | Пример |
|----------|--------|--------|
| Page (компонент-страница) | `<feature>.page.ts` | `appointments.page.ts` |
| Shared компонент | `<name>.component.ts` | `avatar.component.ts` |
| HTTP-сервис | `<feature>.service.ts` | `appointments.service.ts` |
| Интерфейс | `I<Name>` в `<feature>.interface.ts` | `IAppointment` |
| Enum | `E<Name>` в `<feature>.enum.ts` | `EAppointmentStatus` |
| Guard | `<name>Guard` (функциональный) | `authGuard` |
| Interceptor | `<purpose>.interceptor.ts` | `auth.interceptor.ts` |

## Код-стайл
- **Standalone** компоненты предпочтительнее для новых — меньше boilerplate.
- `ChangeDetectionStrategy.OnPush` — **по умолчанию** у всех новых компонентов.
- **Signals** для локального state: `count = signal(0)`, `total = computed(...)`.
- **Inject function**: `private readonly svc = inject(FeatureService)` вместо constructor-injection.
- **`readonly`** для приватных полей-инъекций.
- Только **одиночные** кавычки, trailing comma, semicolons — следуй ESLint-конфигу репо.
- Не используй `any` (strict mode не пропустит). Типизируй HTTP-ответы дженериками.

## Шаблон standalone page
```ts
// src/app/pages/appointments/appointments.page.ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AppointmentsService } from '@core/services/appointments.service';
import { IAppointment } from '@core/models/appointment.interface';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [IonicModule, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appointments.page.html',
  styleUrls: ['./appointments.page.scss'],
})
export class AppointmentsPage {
  private readonly service = inject(AppointmentsService);
  items = signal<IAppointment[]>([]);

  ionViewWillEnter(): void {
    this.service.list().subscribe((res) => this.items.set(res.results));
  }
}
```

Регистрация lazy (standalone):
```ts
{
  path: 'appointments',
  loadComponent: () =>
    import('./pages/appointments/appointments.page').then((m) => m.AppointmentsPage),
  canActivate: [authGuard],
}
```

## Шаблон HTTP-сервиса
```ts
@Injectable({ providedIn: 'root' })
export class AppointmentsService extends HttpHelper {
  list(q?: { date?: string }): Observable<IPaginatedResponse<IAppointment>> {
    return this.httpGetRequest('api/appointment', q);
  }
  getById(id: string): Observable<IAppointment> {
    return this.httpGetRequest(`api/appointment/${id}`);
  }
  create(payload: ICreateAppointment): Observable<{ message: string }> {
    return this.httpPostRequest('api/appointment', payload);
  }
}
```

## Шаблон shared standalone компонента
```ts
@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [IonicModule, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-avatar>
      @if (src()) {
        <img [src]="src()" [alt]="name()" />
      } @else {
        <ion-icon name="person-circle"></ion-icon>
      }
    </ion-avatar>
  `,
})
export class AvatarComponent {
  readonly src = input<string | null>(null);
  readonly name = input<string>('');
}
```

## Path aliases (рекомендуемые — добавь в `tsconfig.json`, когда создашь `core/`)
```jsonc
"paths": {
  "@core/*":       ["src/app/core/*"],
  "@services/*":   ["src/app/core/services/*"],
  "@components/*": ["src/app/core/components/*"],
  "@models/*":     ["src/app/core/models/*"],
  "@pages/*":      ["src/app/pages/*"]
}
```
До первого использования можно не добавлять — не делай мертвую конфигурацию.

## Template-стайл
- Новый Angular control flow: `@if`, `@for`, `@switch` (не `*ngIf`, `*ngFor` в новом коде).
- `(ionChange)`, `(ionInput)` для Ionic-инпутов, НЕ `(change)` / `(input)`.
- На `ion-content` оборачивай весь контент страницы; `ion-header` + `ion-toolbar` для навбара.

## Environments
```ts
// src/environments/environment.ts
export const environment = {
  production: false,
  be_url: 'http://localhost:3000/',   // dev backend
};
```
`environment.prod.ts` — prod URL. `fileReplacements` в `angular.json` подменяет.

## ESLint / форматирование
- `npm run lint` перед коммитом.
- Функции-стрелки предпочтительнее (`eslint-plugin-prefer-arrow`).
- JSDoc на public API сервисов приветствуется.

## Тесты
- Karma + Jasmine (scaffold уже есть). Пиши `*.spec.ts` рядом с файлом.
- Для unit — mock'ай `HttpHelper`-методы (jasmine spies).
- E2E на мобиле — отдельная история (Appium/Detox). Пока не настроено.

