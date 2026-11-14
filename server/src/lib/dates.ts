/**
 * Calendar-date helpers.
 *
 * Daily completion rule: a "day" is a calendar date (YYYY-MM-DD) in the
 * patient's IANA timezone (User.timezone). A completion belongs to the
 * patient-local date on which the server receives it. Dates are stored in
 * PostgreSQL DATE columns, which Prisma exposes as JS Dates at 00:00 UTC.
 */

export type DateKey = string; // "YYYY-MM-DD"

const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date at `now` in `timezone`. */
export function localDateKey(timezone: string, now: Date = new Date()): DateKey {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** DateKey -> Date at 00:00 UTC (the representation Prisma uses for DATE columns). */
export function toDbDate(key: DateKey) {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Prisma DATE value -> DateKey. */
export function fromDbDate(date: Date): DateKey {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromDbDate(new Date(toDbDate(key).getTime() + days * DAY_MS));
}

export function diffDays(from: DateKey, to: DateKey) {
  return Math.round((toDbDate(to).getTime() - toDbDate(from).getTime()) / DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(key: DateKey) {
  return toDbDate(key).getUTCDay();
}

export function eachDate(from: DateKey, to: DateKey): DateKey[] {
  const dates: DateKey[] = [];

  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }

  return dates;
}

export function minKey(a: DateKey, b: DateKey) {
  return a < b ? a : b;
}

export function maxKey(a: DateKey, b: DateKey) {
  return a > b ? a : b;
}
