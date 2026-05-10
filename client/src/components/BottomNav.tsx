import { NavLink } from 'react-router-dom';
import type { BottomNavItem } from '../types/patientDashboard';

type BottomNavProps = {
  items: BottomNavItem[];
};

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 z-50 w-full border-t border-outline-variant bg-surface px-3 py-3 shadow-ambient-lg">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-semibold transition active:scale-95',
                isActive
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high',
              ].join(' ')
            }
          >
            <item.icon className="h-5 w-5" strokeWidth={2.2} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
