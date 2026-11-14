import type { Dictionary } from './index';

/** English needs entries only for plural forms; every other key is its own English text. */
export const en: Dictionary = {
  '{count} exercises': { one: '{count} exercise', other: '{count} exercises' },
  '{count} exercises added to your library': { one: '{count} exercise added to your library', other: '{count} exercises added to your library' },
  '{count} sessions': { one: '{count} session', other: '{count} sessions' },
  '{count} rest days per week': { one: '{count} rest day per week', other: '{count} rest days per week' },
  '{count} records': { one: '{count} record', other: '{count} records' },
  '{count} unread': { one: '{count} unread', other: '{count} unread' },
  '{count} days': { one: '{count} day', other: '{count} days' },
  '{count} weeks': { one: '{count} week', other: '{count} weeks' },
  '{count} pending': { one: '{count} pending', other: '{count} pending' },
  '{count} versions': { one: '{count} version', other: '{count} versions' },
  '{count} to review': { one: '{count} to review', other: '{count} to review' },
};
