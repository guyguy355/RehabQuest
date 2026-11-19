/**
 * Exercise demonstrations: shared types. This file and the animation definitions are plain
 * data and math (no three.js), so they stay out of the lazily loaded 3D chunk.
 */

export type Vec3 = readonly [number, number, number];

/** Joints of the built-in figure. Rotations are Euler XYZ in radians, relative to the parent segment. */
export type JointName =
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'shoulderL'
  | 'elbowL'
  | 'wristL'
  | 'shoulderR'
  | 'elbowR'
  | 'wristR'
  | 'hipL'
  | 'kneeL'
  | 'ankleL'
  | 'hipR'
  | 'kneeR'
  | 'ankleR';

export type Limb = 'armL' | 'armR' | 'legL' | 'legR';

/**
 * Keeps a hand or foot at a fixed place (a foot on the floor, a hand on a wall) while the body moves.
 * The rig solves the two segments of that limb; the pose's own rotations for them are ignored.
 */
export type IkTarget = {
  /** World position of the wrist or ankle. */
  at: Vec3;
  /** World direction the knee or elbow points toward. */
  pole?: Vec3;
  /** Feet only: world rotation of the foot ([0, 0, 0] = flat on the floor, toes toward +z). */
  foot?: Vec3;
  /** Arms only: world rotation of the hand ([0, 0, 0] = fingers down, thumb toward +z). Replaces the wrist rotation. */
  hand?: Vec3;
  /** Arms only: turn of the forearm about its own length (palm up / palm down). */
  twist?: number;
};

export type Pose = {
  /** Pelvis position (metres, y up) and whole-body rotation. */
  root: { position: Vec3; rotation: Vec3 };
  /** Joints left out stay in the neutral standing pose. */
  joints: Partial<Record<JointName, Vec3>>;
  /** Small shifts of a joint away from its place on the body, in metres (e.g. a shoulder shrug). */
  offsets?: Partial<Record<JointName, Vec3>>;
  ik?: Partial<Record<Limb, IkTarget>>;
};

/** Furniture and floor items. Positions are in metres; `turn` is a rotation about the vertical axis in degrees. */
export type Prop = {
  kind: 'mat' | 'chair' | 'wall' | 'counter' | 'step' | 'table' | 'roll' | 'cushion' | 'ball';
  at?: Vec3;
  size?: Vec3;
  turn?: number;
};

/** Things the figure holds or pulls against; they follow the hands. */
export type Held =
  | { kind: 'stick'; look?: 'stick' | 'towel' | 'band' }
  | { kind: 'weight'; hand: 'L' | 'R' }
  | { kind: 'band'; from: Vec3 | JointName; to: JointName; offset?: Vec3; look?: 'band' | 'towel' };

export type ViewName = 'front' | 'side';
export type CameraView = { position: Vec3; target: Vec3 };
export type CameraViews = Record<ViewName, CameraView>;

/** A predefined movement cycle for the built-in figure. `pose` must be a pure function of time. */
export type ProceduralAnimation = {
  key: string;
  /** Length of one repetition in seconds at 1× speed, including the pause between repetitions. */
  duration: number;
  /** A moment that shows the movement well; used as the still frame when motion is reduced. */
  posterTime: number;
  /** pose(0) and pose(duration) must be identical so the loop has no jump. */
  pose: (time: number) => Pose;
  /** The limb doing the work, drawn in the accent colour. */
  highlight: Limb[];
  props: Prop[];
  held?: Held[];
  views: CameraViews;
  /** The view the player opens with (default: side). */
  startView?: ViewName;
};

export type ResolvedDemo =
  | { kind: 'procedural'; animation: ProceduralAnimation }
  | { kind: 'glb'; modelUrl: string; clipName: string | null; views: CameraViews };

/** What the player passes to whichever character is on screen. */
export type Playback = {
  playing: boolean;
  speed: number;
  /** Time (seconds into the cycle) shown before the first frame is played. */
  startTime: number;
  /** Called a few times per second with the position in the current repetition. */
  onTick?: (time: number) => void;
};
