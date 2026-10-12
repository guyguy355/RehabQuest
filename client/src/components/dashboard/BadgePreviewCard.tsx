import { Award, CircleDashed, LockKeyhole } from 'lucide-react';
import type { BadgePreview } from '../../types/patientDashboard';

type BadgePreviewCardProps = {
  badge: BadgePreview;
};

export function BadgePreviewCard({ badge }: BadgePreviewCardProps) {
  const Icon = badge.status === 'earned' ? Award : badge.status === 'in-progress' ? CircleDashed : LockKeyhole;

  return (
    <article
      className={[
        'rounded-2xl border p-4 shadow-ambient',
        badge.status === 'earned'
          ? 'border-secondary-container bg-secondary-container/60'
          : 'border-outline-variant/40 bg-surface-container-lowest',
      ].join(' ')}
    >
      <div
        className={[
          'grid h-12 w-12 place-items-center rounded-2xl',
          badge.status === 'earned' ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-primary',
        ].join(' ')}
      >
        <Icon className="h-6 w-6" strokeWidth={2.2} />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-on-surface">{badge.title}</h3>
      <p className="mt-1 text-sm leading-5 text-on-surface-variant">{badge.description}</p>
    </article>
  );
}
