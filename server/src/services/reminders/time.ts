/**
 * Wall-clock ↔ instant conversion for reminders (ADR-003).
 *
 * Explicit rules:
 * - A reminder time is a local wall-clock time ("HH:mm") in the user's IANA timezone.
 * - Spring-forward gap (the local time does not exist, e.g. 02:30 when clocks jump 02:00→03:00):
 *   the reminder is sent at the same distance after the gap (02:30 → 03:30 local).
 * - Fall-back overlap (the local time happens twice): the first occurrence is used.
 * - Quiet hours are a local "HH:mm"–"HH:mm" range and may span midnight (22:00–07:00).
 *   A reminder due inside quiet hours moves to the end of the quiet period if that is still
 *   the same local day; otherwise it is suppressed for that day.
 */
import { addDays, type DateKey, localDateKey } from '../../lib/dates.js';

export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function minutesOf(time: string) {
  const match = TIME_PATTERN.exec(time);
  if (!match) throw new Error(`Invalid time ${time}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Offset (local − UTC) in minutes for `instant` in `timezone`. */
export function offsetMinutes(timezone: string, instant: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Local wall-clock minutes-of-day at `instant`. */
export function localMinutes(timezone: string, instant: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(instant);
  return Number(parts.find((part) => part.type === 'hour')?.value) * 60 + Number(parts.find((part) => part.type === 'minute')?.value);
}

/** The instant at which the local wall-clock time `time` occurs on `date` in `timezone` (see rules above). */
export function zonedTimeToUtc(date: DateKey, time: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const total = minutesOf(time);
  const wall = Date.UTC(year, month - 1, day, Math.floor(total / 60), total % 60);

  // Candidate offsets around this wall time (before and after any transition that day).
  const before = offsetMinutes(timezone, new Date(wall - 12 * 3600_000));
  const after = offsetMinutes(timezone, new Date(wall + 12 * 3600_000));
  const candidates = [...new Set([before, after])]
    .map((offset) => new Date(wall - offset * 60_000))
    .filter((instant) => localDateKey(timezone, instant) === date && localMinutes(timezone, instant) === total)
    .sort((a, b) => a.getTime() - b.getTime());

  if (candidates.length > 0) return candidates[0]; // normal day, or the first of two (fall-back)
  // Nonexistent local time (spring-forward gap): use the offset from before the gap, which lands after it.
  return new Date(wall - before * 60_000);
}

export function inQuietHours(minutes: number, start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end || start === end) return false;
  const from = minutesOf(start);
  const to = minutesOf(end);
  return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

/**
 * The instant a reminder should be sent on `date`, or null when quiet hours rule it out.
 */
export function reminderInstant(date: DateKey, reminderTime: string, timezone: string, quietStart?: string | null, quietEnd?: string | null): Date | null {
  const minutes = minutesOf(reminderTime);
  if (!inQuietHours(minutes, quietStart, quietEnd)) return zonedTimeToUtc(date, reminderTime, timezone);
  const end = minutesOf(quietEnd!);
  // Quiet period ends later the same day (e.g. reminder 06:30, quiet until 07:00) → send at 07:00.
  if (end > minutes) return zonedTimeToUtc(date, quietEnd!, timezone);
  return null; // quiet until after midnight: no reminder that day
}

export { addDays };
