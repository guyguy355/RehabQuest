# Feature audit — RehabQuest v2 brief

Audit date: 2026-10-12, branch `feature/rehab-platform-v2`.
Baseline verified on this branch before any change: server build ✓, 57/57 server tests ✓, client build ✓,
client lint 0 errors ✓, 7/7 Playwright tests (Chromium) ✓.

Legend: ✅ exists and verified · 🟡 partial · ❌ missing.

## Previously reported capabilities (verified against code and tests)

| Capability | Status | Evidence |
|---|---|---|
| JWT auth, roles from server only | ✅ | `server/src/auth.ts`, `routes/auth.routes.ts`, `tests/auth.test.ts` |
| Therapist–patient authorization (404 on foreign records) | ✅ | `services/access.ts`, `tests/authorization.test.ts` |
| Care-code linking | ✅ | `POST /therapist/patients/link`; unlinking does **not** exist (no "care ended" state) |
| Plans, tasks, daily completions | ✅ | `RehabPlan`, `RehabTask` (activeFrom/activeUntil windows), `TaskCompletion` |
| Transactional, deduplicated XP | ✅ | `services/plans.ts#completeTask`, unique `(taskId, sessionDate)`, `XpEvent.sourceKey` |
| Rest-day-aware streaks, timezones | 🟡 | correct for rest days; **paused periods are not recorded**, so resuming a plan turns paused days into "missed"; changing weekdays rewrites history (documented limitation) |
| Duolingo-inspired UI + mascot | ✅ | `client/src/ui`, `client/src/features` |
| Therapist patient management + review queue | 🟡 | queue = `TaskCompletion.needsReview` flag; no states beyond reviewed, no notes, no search/pagination |
| Optional Claude summary + rule-based fallback | ✅ | `services/summary/*`, `tests/summary.test.ts` |
| Demo data, PostgreSQL tests, browser tests | 🟡 | demo seed writes into the **dev** database (not an explicit demo environment) |

## Stage 1

### A. Templates and version history
| Requirement | Status | Gap → change |
|---|---|---|
| Therapist-owned reusable templates | ❌ | new `ProgramTemplate` + `ProgramTemplateItem` (with `lockVersion`) |
| Duplicate template into independent patient plan | ❌ | copy items into a draft plan version; no FK back to template items |
| Draft / preview / publish / archive | ❌ | new `PlanVersion` (DRAFT → PUBLISHED → SUPERSEDED/DISCARDED); `PlanStatus` gains `DRAFT`, `ARCHIVED` |
| Weekday scheduling, explicit rest days, effective dates | 🟡 weekdays only | `PlanVersion.trainingWeekdays`, `restDates[]`, `effectiveFrom` |
| Ordered tasks: sets, reps, hold, rest, notes | 🟡 no hold/rest | `PlanVersionItem.holdSeconds`, `restSeconds` |
| Patient-view preview | ❌ | preview endpoint returns patient-shaped data from a draft; client renders patient components |
| Immutable published versions | ❌ | published versions/items never updated (enforced in service + tests) |
| Optimistic concurrency | ❌ | `lockVersion` on drafts/templates; stale writes → 409 `stale_draft` |
| Historical completions keep instructions/params | 🟡 params only | completion → `planVersionItemId` (immutable snapshot incl. instructions) |
| One active plan, concurrent publication | ✅ index exists | keep partial unique index; add unique open draft per plan + unique version number |

### B. Guided session player
| Requirement | Status | Gap → change |
|---|---|---|
| Overview + estimated duration (labelled estimate) | 🟡 home card only | session overview step |
| Instructions + authorized media | 🟡 | media only from the therapist's own exercise; text alternative required |
| Set/rep controls, rest/hold timers | 🟡 set ticks only | per-set reps stepper; timestamp-based timers |
| Pause / resume / restore after refresh | ❌ | user-scoped local session state; pause excluded from active time |
| Completed / skipped / partial / stopped | 🟡 completed/stopped | add `PARTIAL`, `SKIPPED` + reason categories |
| Persistent accessible stop action | 🟡 | always-visible stop button |
| Summary with confirmed rewards | ✅ | extend with feedback summary |

## Stage 2

### C. Contextual messaging
| Requirement | Status | Gap → change |
|---|---|---|
| Conversation with authorized therapist | ✅ | keep `Message`; add active-link check |
| Context links (task/completion/plan/review) | ❌ | `contextType` + `contextId`, authorized on send and on read |
| Pagination, unread counts, retry state, server time | ❌/🟡 | cursor pagination, `readAt`, client retry UI |
| Dedup on retry | ❌ | `clientMessageId` unique per sender |
| In-app notifications | ❌ | `Notification` table + notification center |
| Care relationship ends | ❌ | `TherapistPatient.endedAt`; documented policy (ADR-004) |
| Live updates | ❌ | polling (documented) |

### D. Reminders and notifications
| Requirement | Status | Gap → change |
|---|---|---|
| Reminder time, IANA tz | 🟡 time stored; device-only reminder | server pipeline |
| Quiet hours, opt-in/out, snooze | 🟡 opt-in only | new preference fields |
| Suppression (done, rest day, pause) | ❌ | checked at dispatch |
| In-app + optional Web Push | ❌ | `Notification`, `PushSubscription`, `web-push` adapter, dev log adapter |
| DB-backed outbox with retries, multi-worker safe | ❌ | `OutboxJob` with `FOR UPDATE SKIP LOCKED`, dedupe keys, backoff |
| Honest delivery states | ❌ | `NotificationDelivery` QUEUED/ACCEPTED/FAILED; notification `readAt` |

### E. Review workspace
| Requirement | Status | Gap → change |
|---|---|---|
| Filters, explanations, open/ack/resolved, notes, actor, links, search, pagination | 🟡 flag only | new `ReviewItem` (dedupe key), configurable `ReviewSettings`; backfill from flagged completions |

## Stage 3

| Req | Status | Change |
|---|---|---|
| F. Goals + milestones, patient proposal / therapist confirmation, timeline | ❌ | `Goal`, `GoalMilestone`, timeline from `AuditEvent` + versions |
| G. Weekly check-ins, measurements, analytics | ❌ | `WeeklyCheckIn`, `Measurement`, `services/analytics.ts` with fixture tests |
| H. Weekly consistency, celebrations, cosmetics, history, return message, calm mode | 🟡 XP/badges exist | new rules + `UserCosmetic`, `User.calmMode` |
| I. Educational cards, versioned, attachable, acknowledgments | ❌ | `EducationCard`, `EducationCardVersion`, `PlanCardAttachment`, `CardAcknowledgment` |

## Stage 4

| Req | Status | Change |
|---|---|---|
| J. Manifest + icons | 🟡 SVG icon only | PNG icons, install guidance |
| J. Offline snapshot, IndexedDB outbox, sync states | ❌ | custom service worker (injectManifest), `client/src/offline/*`, server occurrence-bound idempotent sync |
| K. English + Hebrew, RTL | ❌ English only | shared translation resources, `dir` switching, logical CSS |
| K. 44×44 targets, reduced motion, sound, no colour-only, chart alternatives | 🟡 | audit + fixes; axe checks in Playwright |

## Stage 5

| Req | Status | Change |
|---|---|---|
| L. Appointment brief with deterministic stats, edit/approve/share, cache, eval set | 🟡 summary only | `AppointmentBrief` model; numbers from code; fact-referenced model output; free-text gate; eval suite |

## Stage 6

| Req | Status | Change |
|---|---|---|
| M. Demo environment and scenario | 🟡 | demo DB `rehabquest_demo` only; scenario e2e |
| N. CSV + print export, formula-injection guard | ❌ | export endpoints + print page |
| N. Audit trail | ❌ | `AuditEvent` |
| N. Log redaction | 🟡 | request logger without bodies/query strings |
| N. CI | ❌ | `.github/workflows/ci.yml` (cannot be executed locally) |
| N. Health/readiness, env validation, CORS diagnosis | 🟡 | `/ready`, zod env schema, CORS rejection logging |
| N. Dependency review | ❌ | `npm audit` summary, no forced fixes |

## Cross-cutting decisions (details in `docs/adr/`)
1. Plan versioning: version rows own schedule and items; past dates always resolve to the version effective then.
2. Completion identity: `(taskId, sessionDate)` stays the unique occurrence key; `RehabTask` becomes the stable
   "slot" shared by versions. Offline work carries `planVersionId` + occurrence date + idempotency key.
3. Outbox delivery: at-least-once attempts, dedupe keys, honest states; no exactly-once claims.
4. Authorization: active care link required for therapist reads; patient keeps own history after link ends.
5. AI: structured, minimized input; numbers only from code; human approval before sharing.
