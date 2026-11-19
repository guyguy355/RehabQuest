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

Approve one movement at a time, after it has been looked at. Do not approve in bulk.

## Client (`client/src/features/demo`)

| File | Role |
|---|---|
| `ExerciseDemo.tsx` | The card on the exercise screen: controls, visibility/reduced-motion rules, fallbacks. No three.js. |
| `DemoCanvas.tsx` | The WebGL scene (lazy chunk): lights, camera views, the character. |
| `ProceduralHumanoid.tsx` | Built-in articulated figure driven by joint rotations. |
| `GlbCharacter.tsx` | Rigged GLB model playing one clip (lazy chunk). |
| `useDemoFrame.ts` | The single clock: pause, speed and looping for either character. |
| `DemoProps.tsx` | Furniture: mat, chair, wall, counter, step, table, roll, cushion, ball. |
| `registry.ts` | Key → animation. Unknown keys resolve to nothing. |
| `animations/build.ts` | Building blocks: starting positions, key-position sequences, mirroring, camera presets. |
| `animations/*.ts` | The movements, grouped by body area. Each is a pure function of time. |
| `gallery.tsx` | Development-only review page: `http://localhost:5173/demo-gallery.html` lists and plays every movement. Not in the production build. |

Behaviour: autoplay when on screen; pauses off screen, in a hidden tab, and on WebGL context loss;
starts paused on a still frame with reduced motion / calm mode; renders on demand while paused;
one canvas, created when first scrolled into view and disposed when the exercise is left. If WebGL
or the model fails, a short message replaces the canvas and the written steps stay.

Use the player only for the one open exercise, never per row in a list.

## Current animations

173 of the 237 starter-catalog exercises have a movement. **All are UNREVIEWED**: written by a
developer from each exercise's text instructions, checked only by eye for obvious errors. Each
needs a physiotherapist's review before its exercise is approved. The list is
`server/src/data/demo-keys.ts`; the demonstration key equals the catalog key (the first one,
`heel-slides` for `knee-heel-slides`, predates that convention).

Catalog exercises without a movement keep their existing content. They are the ones this figure
cannot show honestly:

- fingers, thumb and toes (the hand and foot have no digits), jaw, eyes, breathing, pelvic floor;
- walking exercises (a loop cannot travel) and eyes-closed or plain standing-still exercises;
- a few positions the figure cannot take convincingly yet: `hip-seated-rotation-stretch`,
  `back-straddle-reach`, `shoulder-towel-behind-back-stretch`, `elbow-extension-stretch`,
  `knee-heel-prop`, `core-abdominal-bracing`, `vestibular-brandt-daroff`.

Known simplifications to tell the reviewer about: holds are shortened (a 30-second stretch is
shown for about 5 seconds), the working side is always the same one, and the hand has no grip.

## Adding the next animation

1. Add it to the file for its body area in `animations/`, with `anim(key, start, steps, options)`
   from `build.ts` (or `path(...)` for circles). Every step is written relative to the starting
   position and the last step is `{}`, so the loop closes. Use a fixed contact (`ik`) for a hand or
   foot that stays on the floor, a wall or furniture. Follow the exercise's written instructions;
   do not invent clinical detail.
2. Use the catalog key as the key. Never reuse a key for a different exercise.
3. Attach it: add the key to `server/src/data/demo-keys.ts` (new library copies and the demo seed
   pick it up; `server/tests/demo-keys.test.ts` fails if the client and server lists differ), and
   add a migration for existing copies, as in `20261119090000_exercise_demo_catalog`.
4. Look at it in the gallery (`/demo-gallery.html` on the dev server) from both views, then have a
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
