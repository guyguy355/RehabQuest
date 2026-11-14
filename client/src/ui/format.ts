import { intlLocale, translate } from '../i18n';

// Dates from the API are calendar dates ("YYYY-MM-DD") in the patient's timezone.
// Format them as UTC so the browser timezone can never shift the day.
const cache = new Map<string, Intl.DateTimeFormat>();
function formatter(options: Intl.DateTimeFormatOptions) {
  const locale = intlLocale();
  const key = locale + JSON.stringify(options);
  let instance = cache.get(key);
  if (!instance) {
    instance = new Intl.DateTimeFormat(locale, options);
    cache.set(key, instance);
  }
  return instance;
}

const asDate = (key: string) => new Date(`${key}T00:00:00Z`);

export const formatDay = (key: string) => formatter({ weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(asDate(key));
export const formatLongDay = (key: string) => formatter({ weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(asDate(key));
export const formatShort = (key: string) => formatter({ day: 'numeric', month: 'short', timeZone: 'UTC' }).format(asDate(key));

export function relativeDay(key: string, today: string) {
  const diff = Math.round((asDate(key).getTime() - asDate(today).getTime()) / 86_400_000);
  if (diff === 0) return translate('Today');
  if (diff === 1) return translate('Tomorrow');
  if (diff === -1) return translate('Yesterday');
  return formatDay(key);
}

export function addDays(key: string, days: number) {
  return new Date(asDate(key).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string) {
  return Math.round((asDate(to).getTime() - asDate(from).getTime()) / 86_400_000);
}

export function formatDateTime(iso: string) {
  return formatter({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function formatTime(iso: string) {
  return formatter({ hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** Measurement values: up to 2 decimals, no padding (118, 112.5, 95.25). */
export function formatMeasure(value: number) {
  return new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 2 }).format(value);
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return translate('{n} s', { n: seconds });
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? translate('{m} min {s} s', { m: minutes, s: rest }) : translate('{m} min', { m: minutes });
}

/** Weekday names (0 = Sunday) in the active language. 2026-10-04 is a Sunday. */
export function weekdayName(day: number, style: 'short' | 'long' = 'short') {
  return formatter({ weekday: style, timeZone: 'UTC' }).format(asDate(addDays('2026-10-04', day)));
}

export function weekdayList(days: number[]) {
  return [...days].sort().map((day) => weekdayName(day)).join(', ');
}

export function difficultyLabel(value: 'TOO_EASY' | 'JUST_RIGHT' | 'TOO_HARD') {
  return { TOO_EASY: translate('Too easy'), JUST_RIGHT: translate('About right'), TOO_HARD: translate('Too hard') }[value];
}

export function outcomeLabel(value: 'COMPLETED' | 'PARTIAL' | 'SKIPPED' | 'STOPPED') {
  return { COMPLETED: translate('Completed'), PARTIAL: translate('Partly done'), SKIPPED: translate('Skipped'), STOPPED: translate('Stopped (discomfort)') }[value];
}

export function reasonLabel(value: string) {
  const labels: Record<string, string> = {
    PAIN_OR_DISCOMFORT: translate('Pain or discomfort'),
    TIRED: translate('Too tired'),
    NO_TIME: translate('No time'),
    FORGOT: translate('Forgot'),
    NO_EQUIPMENT: translate('Equipment not available'),
    UNSURE_HOW: translate('Not sure how to do it'),
    OTHER: translate('Other reason'),
  };
  return labels[value] ?? value;
}

export function exerciseDifficultyLabel(value: 'EASY' | 'MEDIUM' | 'HARD') {
  return { EASY: translate('Easy'), MEDIUM: translate('Medium'), HARD: translate('Hard') }[value];
}

/** Estimated active time in whole minutes (sets × seconds per set, plus prescribed rests). Always an estimate. */
export function estimateMinutes(tasks: { sets: number; durationSeconds: number; restSeconds?: number | null }[]) {
  const seconds = tasks.reduce((sum, task) => sum + task.sets * task.durationSeconds + Math.max(0, task.sets - 1) * (task.restSeconds ?? 0), 0);
  return Math.max(1, Math.ceil(seconds / 60));
}
