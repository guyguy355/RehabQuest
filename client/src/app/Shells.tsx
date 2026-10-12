import { BookOpen, ClipboardList, Home, LogOut, MessageCircle, TrendingUp, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { useAuth } from './AuthProvider';

type NavItem = { to: string; label: string; icon: typeof Home; end?: boolean };

const PATIENT_NAV: NavItem[] = [
  { to: '/patient', label: 'Path', icon: Home, end: true },
  { to: '/patient/progress', label: 'Progress', icon: TrendingUp },
  { to: '/patient/messages', label: 'Messages', icon: MessageCircle },
  { to: '/patient/profile', label: 'Profile', icon: UserRound },
];

const THERAPIST_NAV: NavItem[] = [
  { to: '/therapist', label: 'Patients', icon: Users, end: true },
  { to: '/therapist/reviews', label: 'Reviews', icon: ClipboardList },
  { to: '/therapist/exercises', label: 'Exercise library', icon: BookOpen },
];

function SkipLink() {
  return (
    <a href="#main" className="sr-only z-50 rounded-xl bg-white px-4 py-2 font-bold text-brand-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
      Skip to content
    </a>
  );
}

export function PatientShell() {
  return (
    <div className="min-h-screen bg-canvas pb-28 md:pb-10">
      <SkipLink />
      <header className="sticky z-30 border-b-2 border-ink-100 bg-white/95 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <NavLink to="/patient" aria-label="RehabQuest home">
            <Logo />
          </NavLink>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {PATIENT_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-2xl border-2 px-3.5 py-2 font-extrabold transition ${isActive ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-transparent text-ink-500 hover:bg-ink-50'}`
                }
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl px-4 pt-5 md:pt-8">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink-100 bg-white md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {PATIENT_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-xs font-extrabold ${isActive ? 'text-brand-700' : 'text-ink-400'}`}
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-9 w-12 place-items-center rounded-2xl border-2 ${isActive ? 'border-brand-200 bg-brand-50' : 'border-transparent'}`}>
                    <item.icon className="h-6 w-6" aria-hidden="true" strokeWidth={isActive ? 2.6 : 2.2} />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function TherapistShell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const name = auth.status === 'authenticated' ? auth.user.name : '';

  const signOut = () => {
    auth.logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[16rem_1fr]">
      <SkipLink />
      <aside className="border-b-2 border-ink-100 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r-2">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:py-6">
          <NavLink to="/therapist" aria-label="RehabQuest therapist home">
            <Logo />
          </NavLink>
          <button type="button" onClick={signOut} className="btn btn-ghost btn-sm lg:hidden">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </div>
        <nav aria-label="Therapist" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3">
          {THERAPIST_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 font-extrabold transition ${isActive ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-transparent text-ink-500 hover:bg-ink-50'}`
              }
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden border-t-2 border-ink-100 p-4 lg:block">
          <p className="truncate font-extrabold">{name}</p>
          <p className="text-sm text-ink-500">Therapist</p>
          <button type="button" onClick={signOut} className="btn btn-secondary btn-sm mt-3 w-full">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="font-display text-3xl font-bold leading-tight text-ink-900 sm:text-4xl">{title}</h1>
        {children ? <div className="mt-1 text-ink-500">{children}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
