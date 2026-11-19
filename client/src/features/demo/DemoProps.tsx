/** Simple furniture for the demonstrations: enough to show what the figure leans on, sits on or pulls against. */
import type { Prop, Vec3 } from './types';

export const PROP_COLORS = { mat: '#A9D5FA', furniture: '#CBD8D8', wall: '#E3ECEC', soft: '#FFD98A', tool: '#40545A', band: '#E5484D' };

const DEFAULT_SIZE: Record<Prop['kind'], Vec3> = {
  mat: [0.8, 0.03, 2.1],
  chair: [0.46, 0.44, 0.44], // width, seat height, depth
  wall: [1.8, 2.1, 0.1],
  counter: [0.5, 0.9, 1.4],
  step: [0.7, 0.15, 0.5],
  table: [0.9, 0.04, 0.5], // the top; `at` is the centre of the top surface
  roll: [0.3, 0.08, 0], // length, radius
  cushion: [0.3, 0.05, 0.3],
  ball: [0.09, 0, 0], // radius
};

const DEFAULT_AT: Record<Prop['kind'], Vec3> = {
  mat: [0, 0.015, 0],
  chair: [0, 0, -0.03],
  wall: [0, 1.05, 0],
  counter: [0, 0.45, 0],
  step: [0, 0.075, 0],
  table: [0, 0.72, 0],
  roll: [0, 0.08, 0],
  cushion: [0, 0.025, 0],
  ball: [0, 0.09, 0],
};

function Box({ at, size, color }: { at: Vec3; size: Vec3; color: string }) {
  return (
    <mesh position={[...at]} castShadow receiveShadow>
      <boxGeometry args={[...size]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

function Item({ prop }: { prop: Prop }) {
  const size = prop.size ?? DEFAULT_SIZE[prop.kind];
  const [w, h, depth] = size;
  switch (prop.kind) {
    case 'mat':
      return <Box at={[0, 0, 0]} size={size} color={PROP_COLORS.mat} />;
    case 'wall':
      return <Box at={[0, 0, 0]} size={size} color={PROP_COLORS.wall} />;
    case 'cushion':
      return <Box at={[0, 0, 0]} size={size} color={PROP_COLORS.soft} />;
    case 'counter':
    case 'step':
      return <Box at={[0, 0, 0]} size={size} color={PROP_COLORS.furniture} />;
    case 'ball':
      return (
        <mesh castShadow>
          <sphereGeometry args={[w, 20, 16]} />
          <meshStandardMaterial color={PROP_COLORS.soft} roughness={0.8} />
        </mesh>
      );
    case 'roll':
      return (
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[h, h, w, 20]} />
          <meshStandardMaterial color={PROP_COLORS.soft} roughness={0.9} />
        </mesh>
      );
    case 'chair': {
      const legs: Vec3[] = [-1, 1].flatMap((x) => [-1, 1].map((z): Vec3 => [x * (w / 2 - 0.03), (h - 0.05) / 2, z * (depth / 2 - 0.03)]));
      return (
        <>
          <Box at={[0, h - 0.025, 0]} size={[w, 0.05, depth]} color={PROP_COLORS.furniture} />
          <Box at={[0, h + 0.28, -depth / 2 + 0.02]} size={[w, 0.5, 0.04]} color={PROP_COLORS.furniture} />
          {legs.map((leg, index) => (
            <Box key={index} at={leg} size={[0.04, h - 0.05, 0.04]} color={PROP_COLORS.furniture} />
          ))}
        </>
      );
    }
    case 'table': {
      const height = (prop.at ?? DEFAULT_AT.table)[1] - h;
      const legs: Vec3[] = [-1, 1].flatMap((x) => [-1, 1].map((z): Vec3 => [x * (w / 2 - 0.04), -h - height / 2, z * (depth / 2 - 0.04)]));
      return (
        <>
          <Box at={[0, -h / 2, 0]} size={size} color={PROP_COLORS.furniture} />
          {legs.map((leg, index) => (
            <Box key={index} at={leg} size={[0.04, height, 0.04]} color={PROP_COLORS.furniture} />
          ))}
        </>
      );
    }
  }
}

export function DemoProps({ props }: { props: Prop[] }) {
  return (
    <>
      {props.map((prop, index) => (
        <group key={index} position={[...(prop.at ?? DEFAULT_AT[prop.kind])]} rotation={[0, ((prop.turn ?? 0) * Math.PI) / 180, 0]}>
          <Item prop={prop} />
        </group>
      ))}
    </>
  );
}
