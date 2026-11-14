# Analytics rules

Source of truth: `server/src/services/analytics.ts` (pure, tested in `server/tests/analytics.test.ts`).
The patient Trends tab and the therapist Trends tab render the same rows in two charts and a table, so the
chart and the table cannot disagree.

## Weekly rows
- Weeks run Sunday–Saturday in the patient's timezone. The range ends with the current week.
- **Due** sessions are planned training days that have passed, plus today once it is finished.
  Today's unfinished session and future sessions are **pending** and never count as missed.
- **Adherence** = done ÷ due, as a whole percentage (rounded half up). With no due sessions it is
  `null`, shown as "Not applicable" or "—", never 0 %.
- Week status:
  - `no-plan`: no plan days at all that week.
  - `not-applicable`: plan days exist but all are rest days or paused days ("N/A" in the chart).
  - `upcoming`: planned sessions exist but none is due yet.
  - `measured`: at least one session is due.
- Days from every non-draft plan of the patient are included, so a plan change does not reset history.

## Pain
- Weekly pain average = mean of the pain scores reported that week (any outcome with a score), rounded to
  one decimal. A week without a score is `null` and appears as a gap in the line chart and "No reports"
  in the table, never 0.
- The range average is the mean of all reports in the range, not the mean of the weekly means.

## Check-ins
- One per week; all questions optional. An unanswered question is `null` and shown as "No answer".
- The current and the previous week can be answered or changed; older weeks are closed so past rows stay
  stable.

## Measurements and goals
- Values are decimals with 2 places, validated against the measurement's allowed range.
- Goal progress = share of the distance from the starting value to the target covered by the latest value,
  clamped to 0–100 %. The starting value defaults to the first measurement.
- Reaching the target is shown, never confirmed automatically: the therapist confirms goals and milestones.

## What these numbers are not
They are workflow figures for the patient and the therapist. They are not clinical scores, risk ratings or
a diagnosis, and the app does not change the plan based on them.
