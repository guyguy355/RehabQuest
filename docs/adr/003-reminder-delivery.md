# ADR-003: Reminder delivery, the notification outbox and polling

Status: accepted (Stage 2)

## Context
Patients asked for a daily nudge on training days. The previous version only stored a "reminders on"
flag and never sent anything. A reminder system for a rehabilitation app has specific risks:

- a reminder on a rest day, during an approved pause, or after the patient already exercised is noise
  and erodes trust;
- lock screens are visible to other people, so exercise names or symptoms must not appear there;
- the API may run as several processes, so two workers must never send the same reminder;
- browser push is best effort. The push service accepting a message does not mean the person saw it.

## Decision
- **Database outbox.** `OutboxJob` rows (`QUEUED → PROCESSING → DONE | SUPPRESSED | FAILED`) with a unique
  `dedupeKey`. `claimJobs()` uses `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`, so concurrent
  workers take disjoint jobs. A job left in `PROCESSING` by a crashed worker is reclaimed after
  `LOCK_TIMEOUT_MS` (5 min). Failures back off exponentially (30 s × 2ⁿ, capped at 1 h) up to
  `maxAttempts` (5), then become `FAILED` with the last error (truncated, no message bodies).
  `finishJob` only updates a job the worker still holds.
- **Scheduling.** `scheduleReminders()` enqueues at most one job per patient per local day (today and
  tomorrow) with key `reminder:<userId>:<date>`, so re-running is a no-op. Saving reminder settings or
  the timezone deletes that user's still-`QUEUED` reminder jobs (never sent jobs, not history) and
  schedules again.
- **Decide at send time.** `processReminder()` re-reads preferences, the plan and today's results and
  suppresses the reminder (stored as `SUPPRESSED` with a reason) when reminders are off or snoozed, the
  plan is not active, the day is paused or a rest day, every exercise already has a result, or the job's
  date is no longer today for the patient (worker was down).
- **Time rules** (`services/reminders/time.ts`, IANA timezones only):
  - a reminder time that does not exist (spring-forward gap) moves forward by the gap;
  - an ambiguous time (fall-back) uses the first occurrence;
  - a reminder inside quiet hours moves to the end of quiet hours on the same day; if the quiet
    period runs past midnight it is skipped for that day instead of arriving the next morning.
- **Channels.** In-app (`Notification` row, unique `dedupeKey`) is the primary channel. Web Push is
  optional and needs VAPID keys (`npm run push:keys`). Without keys the UI says "Push is not set up on
  this server" and nothing pretends to work. Push payloads use one generic text (`GENERIC_TEXT`) with no
  exercise names, symptoms or message content.
- **Honest delivery states.** `NotificationDelivery.status` is `SENT` (in-app stored), `ACCEPTED` (push
  service returned 2xx), `FAILED` or `SKIPPED`. The app never reports "delivered" or "seen" for push.
  A 404/410 from the push service disables the subscription (`disabledAt`); the row is kept.
- **Development adapter.** Outside production (unless `NOTIFY_DEV_LOG=false`) a log adapter prints that a
  push *would* be sent, with the user id and kind only.
- **Polling, not sockets.** The client polls unread counts every 30 s and an open message thread every
  10 s, only while the tab is visible. This keeps the deployment a single stateless HTTP service.
  WebSockets/SSE are a future option if message volume grows.

## Consequences
- External delivery is at-least-once; duplicates are prevented where we own the target (in-app rows).
- A reminder can arrive up to one worker interval late; this is acceptable for a daily nudge.
- The worker is a separate process (`npm run worker`, or `npm run worker -- --once` for cron-style runs).
- Tested in `tests/reminders.test.ts` (suppression rules, dedupe, concurrent claim, retries, generic
  text) and `tests/reminder-time.test.ts` (DST gaps and overlaps in Asia/Jerusalem and America/New_York,
  quiet hours across midnight).

## Alternatives considered
- A message broker (Redis/BullMQ): one more service to run and back up for a low-volume queue.
- Computing reminders on the client with a service-worker timer: unreliable on mobile and cannot
  respect changes made by the therapist (pause, plan end).
