import { formatDate } from '@angular/common';
import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { angularLocaleFor } from '@core/helpers/locale.helper';

/**
 * Drop-in replacement for Angular's `| date` that follows the app's
 * ngx-translate language at runtime, using Angular's bundled CLDR data
 * (see {@link angularLocaleFor} for why we don't use toLocaleString).
 *
 * Impure on purpose: the language is switched live from the account
 * settings modal (`translate.use(...)` with no reload), and a pure pipe
 * would keep rendering the month names in the language that was active
 * when the view was first stamped. The work per call is a single
 * `formatDate`, and the dates it's used on are few (period ranges, line
 * items), so the impurity cost is negligible.
 *
 * Usage: `{{ someDate | localizedDate:'dd MMM yyyy' }}`
 */
@Pipe({ name: 'localizedDate', standalone: true, pure: false })
export class LocalizedDatePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(
    value: string | number | Date | null | undefined,
    format = 'mediumDate',
  ): string {
    if (value == null || value === '') return '';
    const locale = angularLocaleFor(this.translate.currentLang);
    try {
      return formatDate(value, format, locale);
    } catch {
      return '';
    }
  }
}
