import { CalendarRange, Check, Minus, Moon, PauseCircle, SkipForward, Square } from 'lucide-react';
import type { Day, DayState } from '../../../app/types';
import { useI18n } from '../../../i18n';
import { formatDay } from '../../../ui/format';

const STYLE: Record<DayState, string> = {
  done: 'bg-brand-500 text-white',
  skipped: 'bg-coral-100 text-coral-700',
  missed: 'bg-ink-200 text-ink-500',
  today: 'bg-white text-sky-700 ring-4 ring-sky-300',
  upcoming: 'bg-white text-ink-300 border-2 border-ink-200',
  rest: 'bg-grape-50 text-grape-400',
  paused: 'bg-ink-100 text-ink-400',
};

function DayIcon({ state }: { state: DayState }) {
  const props = { className: 'h-4 w-4', 'aria-hidden': true } as const;
  if (state === 'done') return <Check {...props} strokeWidth={3} />;
  if (state === 'missed') return <Minus {...props} />;
  if (state === 'skipped') return <SkipForward {...props} />;
  if (state === 'rest') return <Moon {...props} />;
  if (state === 'paused') return <PauseCircle {...props} />;
  return <Square className="h-2 w-2" aria-hidden="true" />;
}

/** Plan calendar: one row per plan week. State is shown by icon and label, never by colour alone. */
export function SessionCalendar({ days }: { days: Day[] }) {
  const { t } = useI18n();
  const label = (state: DayState) =>
    ({ done: t('Finished'), skipped: t('Skipped'), missed: t('Not done'), today: t('Today'), upcoming: t('Upcoming'), rest: t('Rest day'), paused: t('Paused') })[state];
  const weeks = new Map<number, Day[]>();
  for (const day of days) weeks.set(day.week, [...(weeks.get(day.week) ?? []), day]);

  return (
    <section className="card grid gap-3 p-5" aria-labelledby="calendar-title">
      <h2 id="calendar-title" className="flex items-center gap-2 font-display text-xl font-bold">
        <CalendarRange className="h-5 w-5 text-brand-600" aria-hidden="true" /> {t('Session calendar')}
      </h2>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1.5">
          <caption className="sr-only">{t('Session calendar')}</caption>
          <tbody>
            {[...weeks.entries()].map(([week, list]) => (
              <tr key={week}>
                <th scope="row" className="pe-2 text-start text-xs font-extrabold text-ink-500">
                  {t('Wk {n}', { n: week })}
                </th>
                {list.map((day) => (
                  <td key={day.date}>
                    <span className={`grid h-9 w-9 place-items-center rounded-lg ${STYLE[day.state]}`} title={`${formatDay(day.date)}: ${label(day.state)} · v${day.versionNumber}`} role="img" aria-label={`${formatDay(day.date)}: ${label(day.state)}`}>
                      <DayIcon state={day.state} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-ink-500" aria-label={t('Legend')}>
        {(['done', 'skipped', 'missed', 'today', 'upcoming', 'rest', 'paused'] as const).map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span className={`grid h-5 w-5 place-items-center rounded ${STYLE[state]}`} aria-hidden="true">
              <DayIcon state={state} />
            </span>
            {label(state)}
          </li>
        ))}
      </ul>
    </section>
  );
}
