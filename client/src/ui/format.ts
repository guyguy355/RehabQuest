// Dates from the API are calendar dates ("YYYY-MM-DD") in the patient's timezone.
// Format them as UTC so the browser timezone can never shift the day.
const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const asDate = (key: string) => new Date(`${key}T00:00:00Z`);

export const formatDay = (key: string) => dayFormat.format(asDate(key));
export const formatLongDay = (key: string) => longDayFormat.format(asDate(key));
export const formatShort = (key: string) => shortFormat.format(asDate(key));

export function relativeDay(key: string, today: string) {
  const diff = Math.round((asDate(key).getTime() - asDate(today).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDay(key);
}

export function addDays(key: string, days: number) {
  return new Date(asDate(key).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function weekdayList(days: number[]) {
  return [...days].sort().map((day) => WEEKDAYS[day]).join(', ');
}

export const DIFFICULTY_LABEL = { TOO_EASY: 'Too easy', JUST_RIGHT: 'About right', TOO_HARD: 'Too hard' } as const;

export function prescription(task: { sets: number; reps: number; durationSeconds: number }) {
  return `${task.sets} × ${task.reps}`;
}
