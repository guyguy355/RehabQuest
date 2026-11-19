/**
 * Building blocks for the movement definitions: a movement is a starting position plus a few
 * key positions the figure moves through and back. Angles are written in degrees here.
 * Plain data and math only (no three.js).
 *
 * Conventions (figure faces +z, its left side is +x):
 *   hip    [-x] lifts the thigh forward, [+x] moves it back, [z] moves it sideways (left leg: + is outward)
 *   knee   [+x] bends
 *   ankle  [+x] points the toes away, [-x] pulls them up, [y] turns the foot
 *   shoulder [-x] lifts the arm forward, [y] turns the arm about its own length, [z] lifts it sideways (left arm: +)
 *   elbow  [-x] bends, [y] turns the forearm (palm up / down)
 *   spine, chest, neck, head: [+x] bends forward, [y] turns, [z] bends sideways (+ is toward the figure's right)
 */
import { easeInOut, SKELETON as S } from '../skeleton';
import type { CameraViews, Held, IkTarget, JointName, Limb, Pose, ProceduralAnimation, Prop, Vec3, ViewName } from '../types';

const RAD = Math.PI / 180;

export type IkKey = { at?: Vec3; pole?: Vec3; foot?: Vec3 | null; hand?: Vec3 | null; twist?: number };
export type Key = {
  /** Pelvis position in metres. */
  p?: Vec3;
  /** Whole-body rotation in degrees. */
  r?: Vec3;
  /** Joint rotations in degrees. */
  j?: Partial<Record<JointName, Vec3>>;
  /** Joint shifts in metres. */
  o?: Partial<Record<JointName, Vec3>>;
  /** Fixed contacts. `null` releases a limb that the starting position holds. */
  ik?: Partial<Record<Limb, IkKey | null>>;
};

/** A key position: where to go, how long the move takes, and how long to stay there (seconds). */
export type Step = [to: Key, move: number, hold?: number];

export function merge(base: Key, over: Key): Key {
  const ik: Key['ik'] = { ...base.ik };
  for (const limb of Object.keys(over.ik ?? {}) as Limb[]) {
    const target = over.ik?.[limb];
    ik[limb] = target ? { ...base.ik?.[limb], ...target } : null;
  }
  return { p: over.p ?? base.p, r: over.r ?? base.r, j: { ...base.j, ...over.j }, o: { ...base.o, ...over.o }, ik };
}

const SWAP: Record<string, string> = { L: 'R', R: 'L' };
const swapSide = <T extends string>(name: T) => name.replace(/[LR]$/, (side) => SWAP[side]) as T;
const flipPoint = ([x, y, z]: Vec3): Vec3 => [-x, y, z];
const flipTurn = ([x, y, z]: Vec3): Vec3 => [x, -y, -z];

/** The same position on the other side of the body. */
export function mirror(key: Key): Key {
  const out: Key = {};
  if (key.p) out.p = flipPoint(key.p);
  if (key.r) out.r = flipTurn(key.r);
  if (key.j) out.j = Object.fromEntries(Object.entries(key.j).map(([name, value]) => [swapSide(name), flipTurn(value)]));
  if (key.o) out.o = Object.fromEntries(Object.entries(key.o).map(([name, value]) => [swapSide(name), flipPoint(value)]));
  if (key.ik) {
    out.ik = Object.fromEntries(
      Object.entries(key.ik).map(([limb, target]) => [
        swapSide(limb),
        target && {
          ...target,
          ...(target.at && { at: flipPoint(target.at) }),
          ...(target.pole && { pole: flipPoint(target.pole) }),
          ...(target.foot && { foot: flipTurn(target.foot) }),
          ...(target.hand && { hand: flipTurn(target.hand) }),
          ...(target.twist !== undefined && { twist: -target.twist }),
        },
      ]),
    );
  }
  return out;
}

const turn = ([x, y, z]: Vec3): Vec3 => [x * RAD, y * RAD, z * RAD];

function toPose(key: Key): Pose {
  const ik: Partial<Record<Limb, IkTarget>> = {};
  for (const limb of Object.keys(key.ik ?? {}) as Limb[]) {
    const target = key.ik?.[limb];
    if (!target?.at) continue;
    ik[limb] = {
      at: target.at,
      ...(target.pole && { pole: target.pole }),
      ...(target.foot && { foot: turn(target.foot) }),
      ...(target.hand && { hand: turn(target.hand) }),
      ...(target.twist !== undefined && { twist: target.twist * RAD }),
    };
  }
  const turned = (map: Key['j']) => Object.fromEntries(Object.entries(map ?? {}).map(([name, value]) => [name, turn(value)]));
  return { root: { position: key.p ?? [0, 0, 0], rotation: turn(key.r ?? [0, 0, 0]) }, joints: turned(key.j), offsets: key.o ?? {}, ik };
}

const ZERO: Vec3 = [0, 0, 0];
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mixMaps = <K extends string>(a: Partial<Record<K, Vec3>> = {}, b: Partial<Record<K, Vec3>> = {}, t: number) => {
  const out: Partial<Record<K, Vec3>> = {};
  for (const name of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<K>) out[name] = mix(a[name] ?? ZERO, b[name] ?? ZERO, t);
  return out;
};

function mixPoses(a: Pose, b: Pose, t: number): Pose {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ik: Partial<Record<Limb, IkTarget>> = {};
  for (const limb of new Set([...Object.keys(a.ik ?? {}), ...Object.keys(b.ik ?? {})]) as Set<Limb>) {
    const from = a.ik?.[limb];
    const to = b.ik?.[limb];
    if (!from || !to) {
      const only = t < 0.5 ? from : to;
      if (only) ik[limb] = only;
      continue;
    }
    const pole = from.pole && to.pole ? mix(from.pole, to.pole, t) : (to.pole ?? from.pole);
    const foot = from.foot && to.foot ? mix(from.foot, to.foot, t) : (to.foot ?? from.foot);
    const hand = from.hand && to.hand ? mix(from.hand, to.hand, t) : (to.hand ?? from.hand);
    const twist = (from.twist ?? 0) + ((to.twist ?? 0) - (from.twist ?? 0)) * t;
    ik[limb] = { at: mix(from.at, to.at, t), ...(pole && { pole }), ...(foot && { foot }), ...(hand && { hand }), ...(twist !== 0 && { twist }) };
  }
  return {
    root: { position: mix(a.root.position, b.root.position, t), rotation: mix(a.root.rotation, b.root.rotation, t) },
    joints: mixMaps(a.joints, b.joints, t),
    offsets: mixMaps(a.offsets, b.offsets, t),
    ik,
  };
}

type Options = {
  /** The limb(s) doing the work, drawn in the accent colour. */
  hl?: Limb[];
  props?: Prop[];
  held?: Held[];
  views: CameraViews;
  startView?: ViewName;
  /** Which step shows the movement best (default: the first); used as the still frame. */
  poster?: number;
  /** Seconds in the starting position before the first move. */
  settle?: number;
};

/** A movement made of key positions. Every step is written relative to the starting position; the last one must be `{}`. */
export function anim(key: string, base: Key, steps: Step[], options: Options): ProceduralAnimation {
  const settle = options.settle ?? 0.5;
  const start = toPose(base);
  const poses = steps.map(([to]) => toPose(merge(base, to)));
  const duration = settle + steps.reduce((total, [, move, hold = 0]) => total + move + hold, 0);
  const posterStep = options.poster ?? 0;
  const posterTime = steps.slice(0, posterStep).reduce((total, [, move, hold = 0]) => total + move + hold, settle) + steps[posterStep][1] + (steps[posterStep][2] ?? 0) / 2;

  const pose = (time: number): Pose => {
    let t = time - settle;
    let from = start;
    if (t <= 0) return start;
    for (let index = 0; index < steps.length; index += 1) {
      const [, move, hold = 0] = steps[index];
      if (t < move) return mixPoses(from, poses[index], easeInOut(t / move));
      t -= move;
      if (t < hold) return poses[index];
      t -= hold;
      from = poses[index];
    }
    return start;
  };
  return finish(key, duration, posterTime, pose, options);
}

/** A movement given as a formula (circles and other paths that key positions cannot describe). `at(0)` must equal `at(duration)`. */
export function path(key: string, base: Key, duration: number, at: (time: number) => Key, options: Options): ProceduralAnimation {
  return finish(key, duration, options.poster ?? duration / 4, (time) => toPose(merge(base, at(time))), options);
}

function finish(key: string, duration: number, posterTime: number, pose: (time: number) => Pose, options: Options): ProceduralAnimation {
  return { key, duration, posterTime, pose, highlight: options.hl ?? [], props: options.props ?? [], held: options.held, views: options.views, startView: options.startView };
}

/** One repetition: go to `top`, stay, come back, rest. */
export const rep = (top: Key, up = 2, hold = 1, down = 2.2, rest = 0.8): Step[] => [
  [top, up, hold],
  [{}, down, rest],
];

/** One repetition on each side, left first. */
export const sides = (top: Key, up = 2, hold = 1, down = 2, rest = 0.5): Step[] => [
  [top, up, hold],
  [{}, down, rest],
  [mirror(top), up, hold],
  [{}, down, rest],
];

/**
 * Camera views around a point. `lift` sets how far above the point the two cameras sit
 * (as a share of the distance); `behind` puts the second view behind the figure (wall in front).
 */
export function cam(target: Vec3, distance: number, lift: [number, number] = [0.22, 0.42], behind = false): CameraViews {
  const [x, y, z] = target;
  return {
    side: { position: [distance, y + distance * lift[0], z + 0.05], target },
    front: { position: [x + distance * 0.38, y + distance * lift[1], z + distance * 0.92 * (behind ? -1 : 1)], target },
  };
}

/** A bend about the sideways axis only (the most common joint movement). */
export const x = (degrees: number): Vec3 => [degrees, 0, 0];

// ---------------------------------------------------------------- starting positions

const H = S.hipHalfWidth;
const FLOOR = S.ankle;
const FLAT: Vec3 = [0, 0, 0];

/** Both feet flat on the floor. */
export const feet = (zLeft = 0, zRight = zLeft, x: number = H): Key['ik'] => ({
  legL: { at: [x, FLOOR, zLeft], foot: FLAT },
  legR: { at: [-x, FLOOR, zRight], foot: FLAT },
});

export const STAND: Key = { p: [0, 0.92, 0], j: { shoulderL: [0, 0, 7], shoulderR: [0, 0, -7] } };

/** Standing with the right hand on a counter at the figure's right side. */
export const AT_COUNTER: Key = merge(STAND, { ik: { armR: { at: [-0.47, 0.97, 0.08], pole: [-0.3, -0.5, -1] } } });
export const COUNTER: Prop = { kind: 'counter', at: [-0.75, 0.45, 0] };

/** Sitting on a chair, feet flat, hands resting on the thighs. */
export const SIT: Key = {
  p: [0, 0.52, 0],
  j: { shoulderL: [-25, 0, 6], shoulderR: [-25, 0, -6], elbowL: [-55, 0, 0], elbowR: [-55, 0, 0] },
  ik: feet(0.42),
};
export const CHAIR: Prop = { kind: 'chair' };

export const MAT: Prop = { kind: 'mat' };
const MAT_TOP = 0.03;

/** Lying on the back, legs straight: head toward -z, feet toward +z. */
export const SUPINE: Key = { p: [0, MAT_TOP + S.backDepth, -0.1], r: [-90, 0, 0], j: { shoulderL: [0, 0, 9], shoulderR: [0, 0, -9] } };

/** Lying on the back, knees bent, feet flat. */
export const HOOK: Key = merge(SUPINE, {
  ik: { legL: { at: [0.1, 0.11, 0.45], pole: [0, 1, 0], foot: FLAT }, legR: { at: [-0.1, 0.11, 0.45], pole: [0, 1, 0], foot: FLAT } },
});
/** Hands resting on the mat beside the hips (for positions where the trunk moves). */
export const HANDS_DOWN: Key['ik'] = { armL: { at: [0.3, 0.07, -0.05] }, armR: { at: [-0.3, 0.07, -0.05] } };

/** Lying face down: head toward +z. */
export const PRONE: Key = { p: [0, 0.13, 0.08], r: [90, 0, 0], j: { ankleL: [70, 0, 0], ankleR: [70, 0, 0], shoulderL: [0, 0, 12], shoulderR: [0, 0, -12] } };

/** Lying on the left side, facing +x, head toward -z. The right arm and leg are on top. */
export const SIDE: Key = { p: [0, 0.225, 0], r: [0, 90, -90], j: { shoulderL: [-90, 0, 0], elbowL: [-60, 0, 0] } };

/** On hands and knees, head toward +z. */
export const QUAD: Key = {
  p: [0, 0.49, -0.2],
  r: [78, 0, 0],
  j: { ankleL: [70, 0, 0], ankleR: [70, 0, 0], neck: [-12, 0, 0] },
  ik: {
    legL: { at: [H, 0.06, -0.62], pole: [0, -1, 0.3] },
    legR: { at: [-H, 0.06, -0.62], pole: [0, -1, 0.3] },
    armL: { at: [0.2, 0.07, 0.23], pole: [0, 0.2, -1] },
    armR: { at: [-0.2, 0.07, 0.23], pole: [0, 0.2, -1] },
  },
};

/** Sitting on the floor with the legs straight in front, leaning back on the hands. */
export const LONG_SIT: Key = {
  p: [0, 0.11, -0.35],
  r: [-15, 0, 0],
  j: { hipL: [-75, 0, 0], hipR: [-75, 0, 0] },
  ik: { armL: { at: [0.25, 0.07, -0.68], pole: [0.3, 0, -1] }, armR: { at: [-0.25, 0.07, -0.68], pole: [-0.3, 0, -1] } },
};

// ---------------------------------------------------------------- camera views

export const VIEW = {
  stand: cam([0, 0.88, 0.05], 4.0, [0.06, 0.14]),
  /** Standing, facing a wall: the second view is from behind. */
  standBehind: cam([0, 0.9, 0.1], 4.1, [0.06, 0.14], true),
  upperBody: cam([0, 1.15, 0.1], 3.1, [0.04, 0.1]),
  sit: cam([0, 0.66, 0.15], 3.6, [0.1, 0.2]),
  sitTable: cam([0, 0.7, 0.3], 3.4, [0.14, 0.3]),
  head: cam([0, 1.08, 0.02], 2.3, [0.03, 0.08]),
  floor: cam([0, 0.27, 0.05], 3.05),
  floorSit: cam([0, 0.38, 0.1], 3.2, [0.16, 0.36]),
  quad: cam([0, 0.38, 0.05], 3.3, [0.14, 0.34]),
} satisfies Record<string, CameraViews>;
