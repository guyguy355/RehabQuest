# ADR-004: Authorization boundaries and ending a care relationship

Status: accepted (Stage 2)

## Context
RehabQuest holds health-related information (pain scores, symptoms in free text, messages). Two kinds of
user exist, and a therapist must only ever see patients who chose to work with them. Stage 2 adds
messages that can link to records, a review queue, notifications and the ability to end a care
relationship, so every new read path is a new place where data could leak.

## Decision
- **Role first, relationship second.** Routers are split by role (`/patient/*`, `/therapist/*`) and
  guarded by `requireRole`. Within the therapist side, every patient-scoped query goes through
  `services/access.ts`: `activeLinkWhere(therapistId)` = `{ therapistId, endedAt: null }`,
  `getLinkedPatient()` and `getOwnedPlanId()`. A record that exists but belongs to someone else returns
  **404, not 403**, so ids cannot be probed.
- **Linking needs consent.** A therapist links a patient with email **and** the patient's care code.
  The patient can regenerate the code at any time; the old code stops working immediately. Existing
  links are unaffected.
- **Message context links are re-authorized on read.** A message stores `contextType` + `contextId`
  (exercise, plan version, exercise record). When a thread is loaded, each link is resolved again for
  the reader; if the reader may not see it any more the message still shows, but the link is replaced
  by "Linked record is no longer available". A patient can only attach their own records.
- **Notifications never quote content.** In-app notification texts are fixed strings plus a person name or an
  exercise title. Message bodies, pain values and notes are never copied into notifications, and push
  payloads use one generic text (ADR-003).
- **Ending care** (either side, `POST …/end-care`), in one transaction:
  - `TherapistPatient.endedAt` / `endedById` are set. The row is kept (history, audit, re-linking).
  - The therapist loses access to the patient at once: lists, details, plans, summaries, messages and
    review items all return 404 or omit the patient.
  - The patient keeps **read-only** access to the message history and to their own records; the
    composer is replaced by an explanation.
  - The ACTIVE plan from that therapist is set to PAUSED with a `PlanPause` from today, so open days are
    not counted as missed and no reminders are sent. The patient home says the care relationship ended
    and points to the care code, rather than "your therapist paused this plan".
  - Open review items for the pair are resolved with the note "Care relationship ended".
  - The other side gets an in-app notification; an `AuditEvent` (`CARE_LINK_ENDED`) is written.
- **Re-linking** requires the care code again; it clears `endedAt` and restores access to the previous
  history. The paused plan stays paused until the therapist resumes it.

## Consequences
- Every new therapist-side query must use `activeLinkWhere`; reviewers should look for raw
  `therapistPatient` queries without `endedAt: null`.
- Ending care is reversible for access but not silent: the audit trail keeps who ended it and when.
- Tested in `tests/authorization.test.ts` (role separation, cross-therapist reads and writes, losing the
  link, care code requirement, messaging pairs), `tests/messaging.test.ts` (context links, care ended
  from both sides, care code regeneration) and `tests/reviews.test.ts` (ended links hidden from the
  queue). The browser test `e2e/communication.spec.ts` ends care from the patient side and checks both
  views.

## Alternatives considered
- Deleting the link row: loses history and makes the audit trail incomplete.
- Keeping therapist read access after care ends: convenient for notes, but the patient withdrew consent;
  a future export-before-ending flow is the better answer.
