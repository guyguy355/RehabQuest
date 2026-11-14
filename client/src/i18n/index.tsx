/**
 * Shared translation resources (English + Hebrew).
 *
 * - Keys are the English source strings: `t('Save draft')`. English needs no dictionary
 *   except for plural forms; Hebrew lives in `he.ts`.
 * - Interpolation: `t('Version {number}', { number: 3 })`.
 * - Plurals: when `count` is passed and the dictionary entry is an object, the form is chosen
 *   with Intl.PluralRules for the active locale (Hebrew has one / two / other).
 * - Strings must be passed to `t()` as literals so `npm run i18n:check` can verify coverage.
 * - The provider sets <html lang dir> so the whole layout switches to RTL for Hebrew.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en } from './en';
import { he } from './he';

export type Locale = 'en' | 'he';
export type PluralForms = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };
export type Dictionary = Record<string, string | PluralForms>;
type Vars = Record<string, string | number>;

const DICTIONARIES: Record<Locale, Dictionary> = { en, he };
const STORAGE_KEY = 'rehabquest.locale';

let activeLocale: Locale = readStoredLocale();

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'he' || stored === 'en') return stored;
  } catch {
    // storage unavailable
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('he') ? 'he' : 'en';
}

export function currentLocale() {
  return activeLocale;
}

export function intlLocale(locale: Locale = activeLocale) {
  return locale === 'he' ? 'he-IL' : 'en-GB';
}

function interpolate(text: string, vars?: Vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Translate outside React components (uses the active locale). */
export function translate(key: string, vars?: Vars, locale: Locale = activeLocale) {
  const entry = DICTIONARIES[locale][key] ?? (locale !== 'en' ? DICTIONARIES.en[key] : undefined) ?? key;
  if (typeof entry === 'string') return interpolate(entry, vars);
  const count = typeof vars?.count === 'number' ? vars.count : 0;
  const rule = new Intl.PluralRules(intlLocale(locale)).select(count) as keyof PluralForms;
  return interpolate(entry[rule] ?? entry.other, vars);
}

type I18nContextValue = {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Vars) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(activeLocale);

  const setLocale = useCallback((next: Locale) => {
    activeLocale = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable
    }
    setLocaleState(next);
  }, []);

  useEffect(() => {
    activeLocale = locale;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr';
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, dir: locale === 'he' ? 'rtl' : 'ltr', setLocale, t: (key, vars) => translate(key, vars, locale) }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}

/** Language switcher used on the login screen and in profile settings. */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  return (
    <div role="group" aria-label="Language / שפה" className={`inline-flex rounded-2xl border-2 border-ink-200 bg-white p-0.5 ${className}`}>
      {(['en', 'he'] as const).map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={locale === option}
          onClick={() => setLocale(option)}
          className={`min-h-11 min-w-11 rounded-xl px-3 text-sm font-extrabold ${locale === option ? 'bg-brand-600 text-white' : 'text-ink-500 hover:bg-ink-50'}`}
        >
          {option === 'en' ? 'English' : 'עברית'}
        </button>
      ))}
    </div>
  );
}
