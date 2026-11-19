import { Bell, BookOpen, BookOpenText, ClipboardList, GraduationCap, Home, LayoutTemplate, LogOut, MessageCircle, TrendingUp, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LanguageSwitch, useI18n } from '../i18n';
import { Logo } from '../ui/Logo';
import { useAuth } from './AuthProvider';
import { useUnread } from './unread';

type NavItem = { to: string; label: string; icon: typeof Home; end?: boolean; badge?: number };

function SkipLink() {
  const { t } = useI18n();
  return (
    <a href="#main" className="sr-only z-50 rounded-xl bg-white px-4 py-2 font-bold text-brand-700 focus:not-sr-only focus:fixed focus:start-4 focus:top-4">
      {t('Skip to content')}
    </a>
  );
}

function CountBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span className="tabular absolute -end-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-black leading-none text-white" aria-label={label}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NotificationBell({ to }: { to: string }) {
  const { t } = useI18n();
  const { notifications } = useUnread();
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `relative grid h-11 w-11 place-items-center rounded-2xl border-2 ${isActive ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-transparent text-ink-500 hover:bg-ink-50'}`}
      aria-label={notifications ? t('Notifications, {count} unread', { count: notifications }) : t('Notifications')}
    >
      <Bell className="h-6 w-6" aria-hidden="true" />
      <CountBadge count={notifications} label="" />
    </NavLink>
  );
}

export function PatientShell() {
  const { t } = useI18n();
  const { messages } = useUnread();
  const nav: NavItem[] = [
    { to: '/patient', label: t('Path'), icon: Home, end: true },
    { to: '/patient/progress', label: t('Progress'), icon: TrendingUp },
    { to: '/patient/learn', label: t('Learn'), icon: BookOpenText },
    { to: '/patient/messages', label: t('Messages'), icon: MessageCircle, badge: messages },
    { to: '/patient/profile', label: t('Profile'), icon: UserRound },
  ];

  return (
    <div className="min-h-screen bg-canvas pb-28 md:pb-10">
      <SkipLink />
      <header className="sticky z-30 border-b-2 border-ink-100 bg-white/95 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <NavLink to="/patient" aria-label={t('RehabQuest home')}>
            <Logo />
          </NavLink>
          <div className="flex items-center gap-1">
            <nav aria-label={t('Main')} className="hidden items-center gap-1 md:flex">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `relative flex min-h-11 items-center gap-2 rounded-2xl border-2 px-3.5 py-2 font-extrabold transition ${isActive ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-transparent text-ink-500 hover:bg-ink-50'}`
                  }
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                  {item.badge ? <CountBadge count={item.badge} label={t('{count} unread', { count: item.badge })} /> : null}
                </NavLink>
              ))}
            </nav>
            <NotificationBell to="/patient/notifications" />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl px-4 pt-5 md:pt-8">
        <Outlet />
      </main>

      <nav aria-label={t('Main')} className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink-100 bg-white md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `flex min-h-14 flex-col items-center gap-0.5 py-2 text-xs font-extrabold ${isActive ? 'text-brand-700' : 'text-ink-500'}`}>
              {({ isActive }) => (
                <>
                  <span className={`relative grid h-9 w-12 place-items-center rounded-2xl border-2 ${isActive ? 'border-brand-200 bg-brand-50' : 'border-transparent'}`}>
                    <item.icon className="h-6 w-6" aria-hidden="true" strokeWidth={isActive ? 2.6 : 2.2} />
                    {item.badge ? <CountBadge count={item.badge} label={t('{count} unread', { count: item.badge })} /> : null}
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
  const { t } = useI18n();
  const auth = useAuth();
  const navigate = useNavigate();
  const name = auth.status === 'authenticated' ? auth.user.name : '';
  const nav: NavItem[] = [
    { to: '/therapist', label: t('Patients'), icon: Users, end: true },
    { to: '/therapist/reviews', label: t('Reviews'), icon: ClipboardList },
    { to: '/therapist/templates', label: t('Templates'), icon: LayoutTemplate },
    { to: '/therapist/exercises', label: t('Exercise library'), icon: BookOpen },
    { to: '/therapist/education', label: t('Education cards'), icon: GraduationCap },
  ];

  const signOut = () => {
    auth.logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[16rem_1fr]">
      <SkipLink />
      <aside className="border-b-2 border-ink-100 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-e-2">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:py-6">
          <NavLink to="/therapist" aria-label={t('RehabQuest therapist home')}>
            <Logo />
          </NavLink>
          <div className="flex items-center gap-1">
            <NotificationBell to="/therapist/notifications" />
            <button type="button" onClick={signOut} className="btn btn-ghost btn-sm lg:hidden">
              <LogOut className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t('Sign out')}
            </button>
          </div>
        </div>
        <nav aria-label={t('Therapist')} className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-11 shrink-0 items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 font-extrabold transition ${isActive ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-transparent text-ink-500 hover:bg-ink-50'}`
              }
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden border-t-2 border-ink-100 p-4 lg:block">
          <p className="truncate font-extrabold">{name}</p>
          <p className="text-sm text-ink-500">{t('Therapist')}</p>
          <LanguageSwitch className="mt-3" />
          <button type="button" onClick={signOut} className="btn btn-secondary btn-sm mt-3 w-full">
            <LogOut className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t('Sign out')}
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
