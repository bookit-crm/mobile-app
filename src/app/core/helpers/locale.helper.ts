/**
 * Maps the ngx-translate language code used across the app ('en' / 'ua')
 * to an Angular locale id that has CLDR data registered (see main.ts —
 * `registerLocaleData(localeUk)`).
 *
 * We deliberately go through Angular's `formatDate` / `DatePipe` (which
 * read this bundled CLDR data) instead of `Date.prototype.toLocaleString`:
 * on iOS the WKWebView's JavaScriptCore ships with a trimmed-down Intl
 * that silently falls back to English for non-English locales, so
 * `toLocaleDateString('uk-UA', …)` rendered English month names on
 * device even though it worked in the desktop browser. Angular's bundled
 * data is platform-independent.
 */
export function angularLocaleFor(lang: string | null | undefined): string {
  return lang === 'ua' ? 'uk' : 'en-US';
}
