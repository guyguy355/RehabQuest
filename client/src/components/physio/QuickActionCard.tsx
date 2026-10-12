import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

type QuickActionCardProps = {
  title: string;
  to: string;
  icon: LucideIcon;
};

export function QuickActionCard({ title, to, icon: Icon }: QuickActionCardProps) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient transition hover:border-primary/40 hover:shadow-ambient-lg active:scale-[0.99]"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-container/20 text-primary">
        <Icon className="h-6 w-6" strokeWidth={2.2} />
      </div>
      <span className="font-display text-lg font-semibold text-on-surface">{title}</span>
    </Link>
  );
}
