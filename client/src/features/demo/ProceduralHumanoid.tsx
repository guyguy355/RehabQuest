/**
 * The built-in figure: a simple articulated mannequin made of capsules and spheres.
 * Neutral pose: standing, pelvis at the origin, facing +z, the figure's left side toward +x.
 * Each joint is a group; an animation is a function that returns joint rotations over time.
 * Limbs with a fixed contact (a foot on the floor, a hand on a wall) are solved here from the
 * contact point, so the animation only has to say where the body and the contact are.
 */
import { useRef } from 'react';
import { Euler, type Group, Matrix4, type Mesh, type Object3D, Quaternion, Vector3 } from 'three';
import { DemoProps, PROP_COLORS } from './DemoProps';
import { SKELETON as S } from './skeleton';
import type { Held, IkTarget, JointName, Limb, Playback, ProceduralAnimation, Vec3 } from './types';
import { useDemoFrame } from './useDemoFrame';

// RehabQuest palette (tailwind.config.js): ink for the body, brand teal for clothing, coral for the working limb.
const COLORS = { body: '#E9EFEF', shirt: '#12A58B', shorts: '#076B5F', accent: '#FF8A5B', face: '#40545A' };

/** Where each joint sits on its parent segment. */
const REST: Record<JointName, Vec3> = {
  spine: [0, 0, 0],
  chest: [0, S.waist, 0],
  neck: [0, S.torso - S.waist, 0],
  head: [0, 0.06, 0],
  shoulderL: [S.shoulderHalfWidth, S.torso - S.waist - 0.04, 0],
  shoulderR: [-S.shoulderHalfWidth, S.torso - S.waist - 0.04, 0],
  elbowL: [0, -S.upperArm, 0],
  elbowR: [0, -S.upperArm, 0],
  wristL: [0, -S.forearm, 0],
  wristR: [0, -S.forearm, 0],
  hipL: [S.hipHalfWidth, 0, 0],
  hipR: [-S.hipHalfWidth, 0, 0],
  kneeL: [0, -S.thigh, 0],
  kneeR: [0, -S.thigh, 0],
  ankleL: [0, -S.shin, 0],
  ankleR: [0, -S.shin, 0],
};
const JOINT_NAMES = Object.keys(REST) as JointName[];

const LIMBS: Record<Limb, { upper: JointName; lower: JointName; end: JointName; lengths: [number, number]; bend: 1 | -1; pole: Vec3 }> = {
  // Knees bend backward (+x) and point forward; elbows bend forward (-x) and point down and back.
  legL: { upper: 'hipL', lower: 'kneeL', end: 'ankleL', lengths: [S.thigh, S.shin], bend: 1, pole: [0, 0, 1] },
  legR: { upper: 'hipR', lower: 'kneeR', end: 'ankleR', lengths: [S.thigh, S.shin], bend: 1, pole: [0, 0, 1] },
  armL: { upper: 'shoulderL', lower: 'elbowL', end: 'wristL', lengths: [S.upperArm, S.forearm], bend: -1, pole: [0, -0.6, -1] },
  armR: { upper: 'shoulderR', lower: 'elbowR', end: 'wristR', lengths: [S.upperArm, S.forearm], bend: -1, pole: [0, -0.6, -1] },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Scratch objects, reused every frame.
const a = new Vector3();
const d = new Vector3();
const pole = new Vector3();
const u = new Vector3();
const X = new Vector3();
const Y = new Vector3();
const Z = new Vector3();
const basis = new Matrix4();
const parentQ = new Quaternion();
const worldQ = new Quaternion();
const bendQ = new Quaternion();
const footQ = new Quaternion();
const euler = new Euler();
const X_AXIS = new Vector3(1, 0, 0);
const UP = new Vector3(0, 1, 0);

/** Two-segment solve: points the limb from its root joint to the target, bending toward the pole. */
function solveLimb(upper: Object3D, lower: Object3D, end: Object3D | null | undefined, lengths: [number, number], bend: 1 | -1, target: IkTarget, defaultPole: Vector3) {
  const [l1, l2] = lengths;
  upper.getWorldPosition(a);
  upper.parent!.getWorldQuaternion(parentQ);
  d.set(...target.at).sub(a);
  const reach = clamp(d.length(), 0.05, l1 + l2 - 0.001);
  if (d.lengthSq() < 1e-8) d.set(0, -1, 0);
  d.normalize();

  if (target.pole) pole.set(...target.pole);
  else pole.copy(defaultPole);
  pole.addScaledVector(d, -pole.dot(d));
  if (pole.lengthSq() < 1e-8) pole.set(d.y, d.z, d.x).addScaledVector(d, -pole.dot(d));
  pole.normalize();

  const cosA = clamp((l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach), -1, 1);
  u.copy(d).multiplyScalar(cosA).addScaledVector(pole, Math.sqrt(1 - cosA * cosA));
  Y.copy(u).negate();
  Z.copy(pole).multiplyScalar(bend);
  X.crossVectors(Y, Z).normalize();
  Z.crossVectors(X, Y);
  worldQ.setFromRotationMatrix(basis.makeBasis(X, Y, Z));
  upper.quaternion.copy(parentQ.invert()).multiply(worldQ);

  const angle = bend * (Math.PI - Math.acos(clamp((l1 * l1 + l2 * l2 - reach * reach) / (2 * l1 * l2), -1, 1)));
  lower.rotation.set(angle, target.twist ?? 0, 0);
  const orientation = target.foot ?? target.hand;
  if (end && orientation) {
    worldQ.multiply(bendQ.setFromAxisAngle(X_AXIS, angle)).invert();
    end.quaternion.copy(worldQ).multiply(footQ.setFromEuler(euler.set(...orientation)));
  }
}

function Segment({ length, radius, color }: { length: number; radius: number; color: string }) {
  return (
    <mesh position={[0, -length / 2, 0]} castShadow>
      <capsuleGeometry args={[radius, length, 6, 16]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

export function ProceduralHumanoid({ animation, playback }: { animation: ProceduralAnimation; playback: Playback }) {
  const root = useRef<Group>(null);
  const joints = useRef<Partial<Record<JointName, Group | null>>>({});
  const links = useRef<(Mesh | null)[]>([]);
  const joint = (name: JointName) => ({
    ref: (node: Group | null) => {
      joints.current[name] = node;
    },
    position: REST[name] as [number, number, number],
  });
  const tone = (limb: Limb) => (animation.highlight.includes(limb) ? COLORS.accent : COLORS.body);
  const held = animation.held ?? [];
  const weightHand = held.find((item) => item.kind === 'weight')?.hand;
  // A stick or band is one thin cylinder stretched between two points that move with the figure.
  const stretched = held.filter((item): item is Exclude<Held, { kind: 'weight' }> => item.kind !== 'weight');

  useDemoFrame(playback, animation.duration, (time) => {
    const figure = root.current;
    if (!figure) return;
    const pose = animation.pose(time);
    figure.position.set(...pose.root.position);
    figure.rotation.set(...pose.root.rotation);
    for (const name of JOINT_NAMES) {
      const group = joints.current[name];
      if (!group) continue;
      const [x, y, z] = pose.joints[name] ?? [0, 0, 0];
      group.rotation.set(x, y, z);
      const rest = REST[name];
      const offset = pose.offsets?.[name];
      group.position.set(rest[0] + (offset?.[0] ?? 0), rest[1] + (offset?.[1] ?? 0), rest[2] + (offset?.[2] ?? 0));
    }

    if (pose.ik) {
      figure.updateMatrixWorld(true);
      for (const limb of Object.keys(pose.ik) as Limb[]) {
        const target = pose.ik[limb];
        const spec = LIMBS[limb];
        const upper = joints.current[spec.upper];
        const lower = joints.current[spec.lower];
        if (!target || !upper || !lower) continue;
        solveLimb(upper, lower, joints.current[spec.end], spec.lengths, spec.bend, target, u.set(...spec.pole).applyQuaternion(figure.quaternion));
      }
    }

    if (stretched.length) {
      figure.updateMatrixWorld(true);
      stretched.forEach((item, index) => {
        const mesh = links.current[index];
        if (!mesh) return;
        if (item.kind === 'stick') {
          joints.current.wristL?.localToWorld(a.set(0, -0.05, 0));
          joints.current.wristR?.localToWorld(d.set(0, -0.05, 0));
        } else {
          if (typeof item.from === 'string') joints.current[item.from]?.getWorldPosition(a);
          else a.set(...item.from);
          joints.current[item.to]?.localToWorld(d.set(...(item.offset ?? [0, 0, 0])));
        }
        u.subVectors(d, a);
        const length = u.length();
        mesh.position.copy(a).addScaledVector(u, 0.5);
        mesh.quaternion.setFromUnitVectors(UP, u.normalize());
        mesh.scale.set(1, length + (item.kind === 'stick' && !item.look ? 0.3 : 0), 1);
      });
    }
  });

  const leg = (side: 'L' | 'R') => {
    const color = tone(`leg${side}`);
    return (
      <group {...joint(`hip${side}`)}>
        <Segment length={S.thigh} radius={0.068} color={color} />
        <group {...joint(`knee${side}`)}>
          <Segment length={S.shin} radius={0.052} color={color} />
          <group {...joint(`ankle${side}`)}>
            <mesh position={[0, -0.035, 0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <capsuleGeometry args={[0.045, 0.14, 6, 14]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
          </group>
        </group>
      </group>
    );
  };

  const arm = (side: 'L' | 'R') => {
    const color = tone(`arm${side}`);
    return (
      <group {...joint(`shoulder${side}`)}>
        <Segment length={S.upperArm} radius={0.045} color={color} />
        <group {...joint(`elbow${side}`)}>
          <Segment length={S.forearm} radius={0.038} color={color} />
          {/* The hand is flat with a thumb, so turning the forearm and bending the wrist can be seen. */}
          <group {...joint(`wrist${side}`)}>
            <mesh position={[0, -0.05, 0]} scale={[0.45, 1.15, 0.9]} castShadow>
              <sphereGeometry args={[0.05, 16, 12]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
            <mesh position={[0, -0.03, 0.048]}>
              <sphereGeometry args={[0.019, 10, 8]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
            {weightHand === side ? (
              <group position={[0, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.02, 0.02, 0.2, 10]} />
                  <meshStandardMaterial color={PROP_COLORS.tool} roughness={0.5} />
                </mesh>
                {[-0.1, 0.1].map((y) => (
                  <mesh key={y} position={[0, y, 0]} castShadow>
                    <sphereGeometry args={[0.04, 12, 10]} />
                    <meshStandardMaterial color={PROP_COLORS.tool} roughness={0.5} />
                  </mesh>
                ))}
              </group>
            ) : null}
          </group>
        </group>
      </group>
    );
  };

  return (
    <>
      <DemoProps props={animation.props} />
      {stretched.map((item, index) => (
        <mesh
          key={index}
          ref={(node) => {
            links.current[index] = node;
          }}
        >
          <cylinderGeometry args={item.look === 'towel' ? [0.028, 0.028, 1, 10] : item.kind === 'band' || item.look === 'band' ? [0.009, 0.009, 1, 8] : [0.014, 0.014, 1, 10]} />
          <meshStandardMaterial color={item.look === 'towel' ? PROP_COLORS.soft : item.kind === 'band' || item.look === 'band' ? PROP_COLORS.band : PROP_COLORS.tool} roughness={0.6} />
        </mesh>
      ))}
      <group ref={root}>
        <mesh scale={[1.25, 0.8, 0.72]} castShadow>
          <sphereGeometry args={[0.13, 20, 16]} />
          <meshStandardMaterial color={COLORS.shorts} roughness={0.7} />
        </mesh>
        {leg('L')}
        {leg('R')}
        <group {...joint('spine')}>
          <mesh position={[0, 0.12, 0]} scale={[1.25, 1, 0.72]} castShadow>
            <capsuleGeometry args={[0.12, 0.1, 8, 20]} />
            <meshStandardMaterial color={COLORS.shirt} roughness={0.7} />
          </mesh>
          <group {...joint('chest')}>
            <mesh position={[0, 0.12, 0]} scale={[1.3, 1, 0.72]} castShadow>
              <capsuleGeometry args={[0.125, 0.1, 8, 20]} />
              <meshStandardMaterial color={COLORS.shirt} roughness={0.7} />
            </mesh>
            {arm('L')}
            {arm('R')}
            <group {...joint('neck')}>
              <mesh position={[0, 0.04, 0]}>
                <cylinderGeometry args={[0.04, 0.045, 0.1, 12]} />
                <meshStandardMaterial color={COLORS.body} roughness={0.6} />
              </mesh>
              <group {...joint('head')}>
                <mesh position={[0, 0.04 + S.headRadius, 0.012]} castShadow>
                  <sphereGeometry args={[S.headRadius, 24, 18]} />
                  <meshStandardMaterial color={COLORS.body} roughness={0.6} />
                </mesh>
                {/* A nose and eyes, only so that turning and nodding the head can be seen. */}
                <mesh position={[0, 0.03 + S.headRadius, 0.012 + S.headRadius]}>
                  <sphereGeometry args={[0.018, 10, 8]} />
                  <meshStandardMaterial color={COLORS.body} roughness={0.6} />
                </mesh>
                {[-0.036, 0.036].map((x) => (
                  <mesh key={x} position={[x, 0.065 + S.headRadius, S.headRadius * 0.92]}>
                    <sphereGeometry args={[0.012, 8, 6]} />
                    <meshStandardMaterial color={COLORS.face} roughness={0.5} />
                  </mesh>
                ))}
              </group>
            </group>
          </group>
        </group>
      </group>
    </>
  );
}
