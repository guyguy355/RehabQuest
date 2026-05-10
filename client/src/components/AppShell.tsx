import { Bell, Home, Medal, TrendingUp, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import type { BottomNavItem } from '../types/patientDashboard';

const patientNavItems: BottomNavItem[] = [
  { label: 'Home', to: '/patient/dashboard', icon: Home },
  { label: 'Quest', to: '/patient/daily-quest', icon: Medal },
  { label: 'Progress', to: '/patient/progress', icon: TrendingUp },
  { label: 'Profile', to: '/patient/badges', icon: UserRound },
];

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background pb-28 text-on-background">
      <header className="sticky top-0 z-40 border-b border-outline-variant/40 bg-surface/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1140px] items-center justify-between px-5">
          <Link to="/patient/dashboard" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-surface-container-highest text-sm font-bold text-primary ring-1 ring-outline-variant/60">
              GA
            </div>
            <span className="font-display text-2xl font-bold text-primary">RehabQuest</span>
          </Link>
          <button
            type="button"
            aria-label="Notifications"
            className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high"
          >
            <Bell className="h-6 w-6" strokeWidth={2.2} />
          </button>
        </div>
      </header>

      {children}

      <BottomNav items={patientNavItems} />
    </div>
  );
}
