import { Bell, ClipboardList, Dumbbell, FilePlus2, LayoutDashboard, Plus, UserPlus, UsersRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

const physioNavItems = [
  { label: 'Dashboard', to: '/physio/dashboard', icon: LayoutDashboard },
  { label: 'Patients', to: '/physio/patients', icon: UsersRound },
  { label: 'Links', to: '/physio/patient-links', icon: UserPlus },
  { label: 'Plans', to: '/physio/plans/new', icon: FilePlus2 },
  { label: 'Custom', to: '/physio/custom-exercises', icon: Plus },
  { label: 'Library', to: '/physio/exercises', icon: Dumbbell },
];

type PhysioShellProps = {
  children: ReactNode;
};

export function PhysioShell({ children }: PhysioShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-on-background">
      <header className="sticky top-0 z-40 border-b border-outline-variant/40 bg-surface/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1140px] items-center justify-between gap-3 px-4 sm:px-5">
          <Link to="/physio/dashboard" className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-on-primary">
              <ClipboardList className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <span className="block truncate font-display text-xl font-bold text-primary sm:text-2xl">RehabQuest</span>
              <span className="block text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                Clinician
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {physioNavItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition',
                    isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container-high',
                  ].join(' ')
                }
              >
                <item.icon className="h-4 w-4" strokeWidth={2.2} />
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/patient/dashboard"
              className="hidden h-10 items-center rounded-xl border border-primary px-3 text-sm font-bold text-primary transition hover:bg-primary/5 sm:flex"
            >
              Switch to Patient Demo
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

      <nav className="border-b border-outline-variant/40 bg-surface px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-[1140px] flex-wrap gap-2">
          {physioNavItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold transition',
                  isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container-high',
                ].join(' ')
              }
            >
              <item.icon className="h-4 w-4" strokeWidth={2.2} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="border-b border-outline-variant/40 bg-surface px-4 py-3 sm:hidden">
        <Link
          to="/patient/dashboard"
          className="mx-auto flex h-10 max-w-[1140px] items-center justify-center rounded-xl border border-primary text-sm font-bold text-primary"
        >
          Switch to Patient Demo
        </Link>
      </div>

      {children}
    </div>
  );
}
