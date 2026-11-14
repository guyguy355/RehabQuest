# Achievements and motivation rules

Source of truth: `server/src/services/progress.ts` (session achievements), `server/src/services/gamification.ts`
(weekly goal, welcome back, counts, cosmetics) and `server/src/services/achievement-rules.ts` (the text patients see).
Every rule below has a test (file in brackets).

## Principles
- Rewards come only from prescribed sessions, weekly check-ins, and milestones the therapist confirmed.
  Extra activity, pain scores and stopping early never earn or cost anything.
- Nothing is taken away. Reopening a milestone or changing a plan never removes an achievement.
- Rest days and approved pauses never count as missed.
- No leaderboards, no comparison with other patients, nothing to buy.
- Weeks run Sunday to Saturday in the patient's timezone.

## Achievements

| Id | Name | Rule | Test |
|---|---|---|---|
| `first-session` | First Step | All exercises of one planned session have an outcome, at least one not skipped (a symptom stop counts). | progress.test.ts |
| `steady-three` | Steady Rhythm | 3 done planned sessions in a row; rest and paused days are skipped over. | progress.test.ts |
| `full-week` | Full Week | Every planned session of one plan week (counted from the plan start) is done. | progress.test.ts |
| `halfway` | Halfway There | Done sessions ≥ half of all planned sessions (plans with ≥ 2 sessions). | progress.test.ts |
| `plan-complete` | Plan Finisher | The last planned session of the plan is done. | progress.test.ts |
| `weekly-goal` | Week Goal Met | The weekly goal is reached in 1 week. | gamification.test.ts, care.test.ts |
| `weekly-goal-4` | Four Good Weeks | The weekly goal is reached in 4 different weeks (not necessarily in a row). | gamification.test.ts |
| `welcome-back` | Welcome Back | A session is done right after a run of ≥ 3 missed or skipped planned sessions (rest/paused ignored). | gamification.test.ts |
| `first-check-in` | Checked In | 1 weekly check-in sent. | gamification.test.ts, care.test.ts |
| `check-in-4` | Regular Check-ins | Check-ins in 4 different weeks. | gamification.test.ts |
| `first-milestone` | Milestone Reached | The therapist confirms the first milestone. | gamification.test.ts, care.test.ts |

## Weekly consistency goal
- The patient chooses 1–7 sessions a week, or "every planned session" (default).
- Target for a week = min(chosen goal, planned sessions that week). It never asks for more than the plan.
- A week with no planned sessions is "not applicable": no goal and nothing to miss.
- The first time a week's goal is reached it is recorded once (`WeeklyGoalWeek`) and celebrated once.

## Return after a break
When the last 2 or more planned sessions before today were missed or skipped and today's session is not
done, the home screen shows a short, non-judgemental welcome-back note. No streak warnings, no guilt.

## Calm mode and sound
Calm mode (saved to the account, also turned on by the OS "reduce motion" setting) removes animations and
celebration motion. Sound is off by default; when on, only a short chime plays when a timer ends.

## Mascot looks
Pip's looks are cosmetic only and unlock with achievements: classic (always), sunny sweatband
(`first-session`), scarf (`steady-three`), cap (`full-week`), headphones (`weekly-goal`), flower
(`welcome-back`), glasses (`first-check-in`), medal (`plan-complete`). The server refuses a locked look.
