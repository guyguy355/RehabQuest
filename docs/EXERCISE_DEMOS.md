# Animated 3D exercise demonstrations

When a patient opens an exercise in a session, a small 3D figure can perform the movement in a
loop above the written steps. It is a real-time scene (Three.js via React Three Fiber), not a video,
and nothing is generated at runtime: each exercise points at one predefined animation.

## Rules

- **One animation per exercise.** An exercise without its own animation shows no player and keeps
  its existing content (steps, therapist image/video). A generic animation is never substituted.
- **Review gate.** Every demonstration starts as `UNREVIEWED`. Patients see it only after a
  physiotherapist has checked the movement and the exercise's `demoReviewStatus` is `APPROVED`.
  `REJECTED` is never sent. Nothing in the app calls a demonstration clinically validated.
- **Preview mode.** With `EXERCISE_DEMO_PREVIEW=true` (default outside production, off in
  production) the API also sends `UNREVIEWED` demonstrations and the player labels them
  "Preview · not yet reviewed by a physiotherapist".
- **Display only.** The player never counts repetitions, ticks sets or records anything.
- Editing an exercise's title or instructions sends an approved demonstration back to `UNREVIEWED`.

## Data

Columns on `Exercise` (migration `20261114090000_exercise_demo`):

| Column | Meaning |
|---|---|
| `demoType` | `PROCEDURAL` (built-in figure) or `GLB` (rigged model + clip); null = no demonstration |
| `demoKey` | animation key in the client registry (`PROCEDURAL`), or a label for the asset (`GLB`) |
| `demoReviewStatus` | `UNREVIEWED` (default), `APPROVED`, `REJECTED` |
| `demoModelUrl` | `GLB` only: same-origin path (e.g. `/models/figure.glb`) or https URL |
| `demoClipName` | `GLB` only: animation clip inside the model; null = first clip |

The demonstration is read live from the exercise when a plan is serialized (`serializeDemo` in
`server/src/services/demos.ts`), not snapshotted into plan versions, so an approval or rejection
applies to plans that are already published. Patient responses carry it as `exercise.demo`.

There is no approval screen yet. To approve after a physiotherapist's review:

```sql
UPDATE "Exercise" SET "demoReviewStatus" = 'APPROVED' WHERE "demoKey" = 'heel-slides' AND "createdById" = '<therapist id>';
```

## Client (`client/src/features/demo`)

| File | Role |
|---|---|
| `ExerciseDemo.tsx` | The card on the exercise screen: controls, visibility/reduced-motion rules, fallbacks. No three.js. |
| `DemoCanvas.tsx` | The WebGL scene (lazy chunk): lights, camera views, the character. |
| `ProceduralHumanoid.tsx` | Built-in articulated figure driven by joint rotations. |
| `GlbCharacter.tsx` | Rigged GLB model playing one clip (lazy chunk). |
| `useDemoFrame.ts` | The single clock: pause, speed and looping for either character. |
| `registry.ts` | Key → animation. Unknown keys resolve to nothing. |
| `animations/*.ts` | One file per movement: a pure `pose(time)` function plus camera views. |

Behaviour: autoplay when on screen; pauses off screen, in a hidden tab, and on WebGL context loss;
starts paused on a still frame with reduced motion / calm mode; renders on demand while paused;
one canvas, created when first scrolled into view and disposed when the exercise is left. If WebGL
or the model fails, a short message replaces the canvas and the written steps stay.

Use the player only for the one open exercise, never per row in a list.

## Current animations

| Key | Exercise (catalog key) | Status |
|---|---|---|
| `heel-slides` | Heel slides (`knee-heel-slides`) | UNREVIEWED: written by a developer from the exercise's text instructions; needs physiotherapist review |

## Adding the next animation

1. Create `animations/<name>.ts` exporting a `ProceduralAnimation`: `duration`, a pure `pose(time)`
   whose first and last pose are identical (include the pause between repetitions), `posterTime`,
   the highlighted limb, and `front`/`side` camera views. Follow the exercise's written
   instructions; do not invent clinical detail. State in the file header that it is unreviewed.
2. Register it in `registry.ts` under a new key. Never reuse a key for a different exercise.
3. Attach it: add the catalog key to `CATALOG_DEMOS` in `server/src/services/demos.ts` (new library
   copies and the demo seed pick it up), and add a migration that sets `demoType`/`demoKey` on
   existing copies (`WHERE "catalogKey" = '…'`), as in `20261114090000_exercise_demo`.
4. Check it in preview mode, extend `client/e2e/demo.spec.ts` if behaviour changed, then have a
   physiotherapist review it before approving.

## Replacing the figure with a rigged GLB

1. Put the model in `client/public/models/` (it is then served at `/models/<file>.glb`), with one
   named animation clip per exercise. Each clip should loop cleanly.
2. Point the exercise at it: `demoType = 'GLB'`, `demoKey = '<label>'`,
   `demoModelUrl = '/models/<file>.glb'`, `demoClipName = '<clip>'`, status `UNREVIEWED`.
3. The player loads it through `GlbCharacter.tsx`, scales it to about 1.7 m and uses the standing
   camera views in `registry.ts` (`STANDING_VIEWS`); add per-exercise views there if a clip is
   performed lying down.

The GLB path has not been exercised with a real asset yet (none exists in the repository); only its
failure fallback is covered by tests. Test it with the first model before relying on it.
