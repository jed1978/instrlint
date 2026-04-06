import enMessages from './en.json';
import zhTWMessages from './zh-TW.json';

type Locale = 'en' | 'zh-TW';

const LOCALE_MAP: Record<Locale, Record<string, string>> = {
  en: enMessages as Record<string, string>,
  'zh-TW': zhTWMessages as Record<string, string>,
};

let _locale: Locale = 'en';
let _messages: Record<string, string> = LOCALE_MAP['en'];

/** Detect locale from environment / system, falling back to 'en'. */
export function detectLocale(): Locale {
  const env = process.env['INSTRLINT_LANG'];
  if (env === 'zh-TW' || env === 'en') return env;
  try {
    const sys = Intl.DateTimeFormat().resolvedOptions().locale;
    if (sys.startsWith('zh')) return 'zh-TW';
  } catch {
    // ignore
  }
  return 'en';
}

/**
 * Set the active locale. Call once at CLI startup with the --lang value.
 * Falls back to detectLocale() if lang is unrecognised or omitted.
 */
export function initLocale(lang?: string): void {
  const valid: Locale[] = ['en', 'zh-TW'];
  const resolved: Locale = valid.includes(lang as Locale) ? (lang as Locale) : detectLocale();
  _locale = resolved;
  _messages = LOCALE_MAP[resolved];
}

/** Return current active locale. */
export function getLocale(): Locale {
  return _locale;
}

/**
 * Look up a translation key and interpolate {{param}} placeholders.
 * Returns the key itself when no translation is found.
 */
export function t(key: string, params?: Record<string, string>): string {
  const template = _messages[key] ?? key;
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => params[k] ?? `{{${k}}}`);
}

/** Plural suffix helper: returns 's' for count !== 1, '' otherwise. */
export function plural(count: number): string {
  return count === 1 ? '' : 's';
}
