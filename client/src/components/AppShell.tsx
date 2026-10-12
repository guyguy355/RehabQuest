import { Bell, Home, Medal, TrendingUp, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import type { BottomNavItem } from '../types/patientDashboard';

const patientNavItems: BottomNavItem[] = [
  { label: 'Home', to: '/patient/dashboard', icon: Home },
  { label: 'Quest', to: '/patient/quest', icon: Medal },
  { label: 'Progress', to: '/patient/progress', icon: TrendingUp },
  { label: 'Profile', to: '/patient/badges', icon: UserRound },
];

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-28 text-on-background">
      <header className="sticky top-0 z-40 border-b border-outline-variant/40 bg-surface/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1140px] items-center justify-between gap-3 px-4 sm:px-5">
          <Link to="/patient/dashboard" className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-surface-container-highest text-sm font-bold text-primary ring-1 ring-outline-variant/60">
              GA
            </div>
            <span className="truncate font-display text-xl font-bold text-primary sm:text-2xl">RehabQuest</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/physio/dashboard"
              className="hidden h-10 items-center rounded-xl border border-primary px-3 text-sm font-bold text-primary transition hover:bg-primary/5 sm:flex"
            >
              Switch to Physio Demo
            </Link>
            <button
              type="button"
              aria-label="Notifications"
              className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high"
            >
              <Bell className="h-6 w-6" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </header>

      {children}

      <div className="fixed bottom-[88px] left-0 z-40 w-full px-4 sm:hidden">
        <Link
          to="/physio/dashboard"
          className="mx-auto flex h-11 max-w-md items-center justify-center rounded-xl border border-primary bg-surface text-sm font-bold text-primary shadow-ambient"
        >
          Switch to Physio Demo
        </Link>
      </div>
      <BottomNav items={patientNavItems} />
    </div>
  );
}
