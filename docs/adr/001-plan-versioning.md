# ADR-001: Plan versioning and historical data

Status: accepted (Stage 1)

## Context
Therapists revise plans while patients are following them. The previous model edited tasks in place and
derived each day's prescription from task windows and the plan's current weekdays. Two problems followed:
changing training weekdays rewrote past days (a missed day could become a rest day, or the reverse), and
past records could not show the instructions that applied at the time.

## Decision
- `RehabPlan` is the container (patient, therapist, lifecycle status, `revision` counter).
- `PlanVersion` holds everything that is prescribed: title, focus, weekdays, explicit rest dates,
  `effectiveFrom`, `endDate`, and its `PlanVersionItem`s with a snapshot of the exercise text taken at
  publication. Published versions are never updated.
- The version that applies to a date is the published version with the latest `effectiveFrom <= date`
  (ties: higher number). Revisions must take effect today or later in the patient's timezone, so dates
  that have passed always resolve to the version that applied then.
- `RehabTask` remains the stable "slot" for one prescribed exercise across versions. Completions stay unique
  per `(taskId, sessionDate)` and additionally point to the exact `PlanVersionItem` that was prescribed,
  plus a copy of the prescribed numbers.
- Templates are copied into drafts, never linked. Editing a template cannot change an assigned plan.
- Drafts and templates use an optimistic `lockVersion`. A stale write gets 409 (`stale_draft`,
  `stale_template`) and the editor keeps the user's unsaved input with two explicit choices.
- Concurrency invariants are enforced by the database: one ACTIVE plan per patient (partial unique index),
  one DRAFT per plan (partial unique index), unique `(planId, number)`; publication locks the plan row.
- Approved pauses are stored as date ranges (`PlanPause`) so paused days are never counted as missed.

## Consequences
- Adherence for past dates is stable across revisions (tested in `tests/progress.test.ts` and
  `tests/authoring.test.ts`).
- The migration rebuilt version history from existing task windows. Earlier in-place parameter edits could not
  be recovered, so backfilled versions carry the parameters stored at migration time; completions kept their
  own snapshot.
- Deleting a plan (or a patient account) removes its slots, versions, items and records together; a completion
  never disappears because of an item deletion (`ON DELETE SET NULL`).
