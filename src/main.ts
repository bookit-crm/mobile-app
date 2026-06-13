import { registerLocaleData } from '@angular/common';
import localeUk from '@angular/common/locales/uk';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

// Bundle Ukrainian CLDR data so Angular's DatePipe / formatDate (and the
// LocalizedDatePipe built on top of them) can render Ukrainian month
// names on iOS, where the WebView's native Intl lacks the locale data.
// English is registered by Angular out of the box.
registerLocaleData(localeUk);

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
