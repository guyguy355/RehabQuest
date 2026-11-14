import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { inQuietHours, minutesOf, reminderInstant, zonedTimeToUtc } from '../src/services/reminders/time.js';

describe('reminder times across timezones and DST', () => {
  test('normal days convert local time to the right instant', () => {
    assert.equal(zonedTimeToUtc('2026-10-12', '09:00', 'Asia/Jerusalem').toISOString(), '2026-10-12T06:00:00.000Z'); // UTC+3 (summer)
    assert.equal(zonedTimeToUtc('2026-12-01', '09:00', 'Asia/Jerusalem').toISOString(), '2026-12-01T07:00:00.000Z'); // UTC+2 (winter)
    assert.equal(zonedTimeToUtc('2026-07-01', '09:00', 'America/New_York').toISOString(), '2026-07-01T13:00:00.000Z');
  });

  test('spring-forward gap: a nonexistent local time moves forward by the gap', () => {
    // US: 2026-03-08 02:00 → 03:00. 02:30 does not exist → 03:30 EDT = 07:30Z.
    assert.equal(zonedTimeToUtc('2026-03-08', '02:30', 'America/New_York').toISOString(), '2026-03-08T07:30:00.000Z');
    // Israel: 2026-03-27 02:00 → 03:00.
    assert.equal(zonedTimeToUtc('2026-03-27', '02:15', 'Asia/Jerusalem').toISOString(), '2026-03-27T00:15:00.000Z');
    // Times outside the gap on the transition day are exact.
    assert.equal(zonedTimeToUtc('2026-03-08', '09:00', 'America/New_York').toISOString(), '2026-03-08T13:00:00.000Z');
  });

  test('fall-back overlap: an ambiguous local time uses the first occurrence', () => {
    // US: 2026-11-01 02:00 → 01:00. 01:30 happens at 05:30Z (EDT) and 06:30Z (EST).
    assert.equal(zonedTimeToUtc('2026-11-01', '01:30', 'America/New_York').toISOString(), '2026-11-01T05:30:00.000Z');
    // Israel: 2026-10-25 02:00 → 01:00.
    assert.equal(zonedTimeToUtc('2026-10-25', '01:30', 'Asia/Jerusalem').toISOString(), '2026-10-24T22:30:00.000Z');
  });

  test('quiet hours, including ranges across midnight', () => {
    assert.equal(inQuietHours(minutesOf('23:00'), '22:00', '07:00'), true);
    assert.equal(inQuietHours(minutesOf('06:59'), '22:00', '07:00'), true);
    assert.equal(inQuietHours(minutesOf('07:00'), '22:00', '07:00'), false);
    assert.equal(inQuietHours(minutesOf('13:00'), '12:00', '14:00'), true);
    assert.equal(inQuietHours(minutesOf('13:00'), null, null), false);
  });

  test('a reminder inside quiet hours moves to the end of the quiet period, or is skipped for the day', () => {
    // Reminder 06:30, quiet 22:00–07:00 → sent at 07:00 local.
    assert.equal(reminderInstant('2026-10-12', '06:30', 'Asia/Jerusalem', '22:00', '07:00')?.toISOString(), '2026-10-12T04:00:00.000Z');
    // Reminder 23:00, quiet 22:00–07:00 → quiet until tomorrow → no reminder that day.
    assert.equal(reminderInstant('2026-10-12', '23:00', 'Asia/Jerusalem', '22:00', '07:00'), null);
    // Outside quiet hours → unchanged.
    assert.equal(reminderInstant('2026-10-12', '09:00', 'Asia/Jerusalem', '22:00', '07:00')?.toISOString(), '2026-10-12T06:00:00.000Z');
  });
});
