import { CalendarCheck, Flag, Footprints, Lock, Trophy, Waves } from 'lucide-react';
import type { Badge } from '../app/types';

const ICONS = { footprints: Footprints, waves: Waves, 'calendar-check': CalendarCheck, flag: Flag, trophy: Trophy } as const;
const COLORS: Record<string, { face: string; edge: string }> = {
  'first-session': { face: '#2BBFA4', edge: '#0A8274' },
  'steady-three': { face: '#FF8A5B', edge: '#C8501F' },
  'full-week': { face: '#2E8FE0', edge: '#155A96' },
  halfway: { face: '#A67CFF', edge: '#5B34C2' },
  'plan-complete': { face: '#FFC81A', edge: '#B88700' },
};

/** A hexagonal medal. Locked medals are grey with a lock. */
export function BadgeMedal({ badge, size = 72, animate = false }: { badge: Pick<Badge, 'id' | 'icon' | 'earnedAt' | 'name'>; size?: number; animate?: boolean }) {
  const earned = Boolean(badge.earnedAt);
  const Icon = earned ? ICONS[(badge.icon ?? 'trophy') as keyof typeof ICONS] ?? Trophy : Lock;
  const colors = earned ? COLORS[badge.id] ?? COLORS['plan-complete'] : { face: '#D3DDDD', edge: '#A7B6B6' };

  return (
    <div className={`relative shrink-0 ${animate ? 'animate-pop' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <path d="M32 6 L54 18 L54 44 L32 58 L10 44 L10 18 Z" fill={colors.edge} transform="translate(0 3)" />
        <path d="M32 6 L54 18 L54 44 L32 58 L10 44 L10 18 Z" fill={colors.face} />
        <path d="M32 11 L49 21 L49 41 L32 52 L15 41 L15 21 Z" fill="#fff" opacity="0.22" />
      </svg>
      <Icon className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white" style={{ width: size * 0.38, height: size * 0.38 }} strokeWidth={2.6} />
    </div>
  );
}
