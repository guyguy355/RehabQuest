import { type KeyboardEvent, type ReactNode, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export type TabDef = { id: string; label: string; badge?: ReactNode };

/**
 * WAI-ARIA tabs with automatic activation. The selected tab is kept in the URL
 * (?tab=...) so links can point at a specific tab and refresh keeps it.
 */
export function useTabState(tabs: TabDef[], param = 'tab') {
  const [params, setParams] = useSearchParams();
  const current = tabs.find((tab) => tab.id === params.get(param))?.id ?? tabs[0].id;
  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set(param, id);
    setParams(next, { replace: true });
  };
  return [current, select] as const;
}

export function Tabs({ tabs, current, onSelect, label }: { tabs: TabDef[]; current: string; onSelect: (id: string) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const rtl = document.documentElement.dir === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = index;
    if (event.key === forward) next = (index + 1) % tabs.length;
    else if (event.key === backward) next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    onSelect(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b-2 border-ink-100 pb-0.5">
      {tabs.map((tab, index) => {
        const selected = tab.id === current;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            id={`tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`-mb-0.5 flex min-h-11 shrink-0 items-center gap-2 border-b-4 px-3 font-extrabold transition ${selected ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-900'}`}
          >
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, current, children }: { id: string; current: string; children: ReactNode }) {
  if (id !== current) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0} className="grid gap-6 focus-visible:outline-none">
      {children}
    </div>
  );
}
