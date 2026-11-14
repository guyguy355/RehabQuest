import { useState } from 'react';
import type { WeekRow } from '../../app/types';
import { useI18n } from '../../i18n';
import { formatNumber, formatShort } from '../../ui/format';

/**
 * Weekly trends from one list of rows (server: services/analytics.ts). The two charts and the table
 * render the same rows, so they always agree.
 * - Two separate charts (sessions done %, average pain 0–10), never a dual axis.
 * - Weeks without planned sessions show "N/A" (rest or paused) or nothing (no plan), never 0.
 * - Weeks without pain reports leave a gap in the pain line, never 0.
 * - Every mark has a keyboard-focusable tooltip; the table is the full alternative.
 */
const W = 640;
const H = 190;
const PAD = { top: 14, right: 10, bottom: 28, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function useWeekLabel() {
  const { t } = useI18n();
  return (row: WeekRow) => t('Week of {date}', { date: formatShort(row.weekStart) });
}

export function useWeekDescriptions() {
  const { t } = useI18n();
  return {
    sessions(row: WeekRow) {
      if (row.status === 'no-plan') return t('No plan this week');
      if (row.status === 'not-applicable') return row.pausedDays > 0 && row.restDays === 0 ? t('Not applicable: plan paused') : t('Not applicable: rest days only');
      if (row.status === 'upcoming') return t('{count} planned, none due yet', { count: row.planned });
      return t('{done} of {due} due sessions done ({percent}%)', { done: row.done, due: row.due, percent: row.adherencePercent ?? 0 }) + (row.pending ? ` · ${t('{count} pending', { count: row.pending })}` : '');
    },
    pain(row: WeekRow) {
      if (row.painAverage === null) return t('No pain reports');
      return t('Average {avg}/10 from {count} reports, highest {max}', { avg: formatNumber(row.painAverage, 1), count: row.painReports, max: row.painMax ?? 0 });
    },
  };
}

function Tooltip({ x, text }: { x: number; text: string }) {
  const left = Math.min(85, Math.max(15, (x / W) * 100));
  return (
    <div role="status" className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-ink-900 px-3 py-2 text-xs font-bold text-white shadow-lg" style={{ left: `${left}%` }}>
      {text}
    </div>
  );
}

function Axis({ ticks, y, format }: { ticks: number[]; y: (value: number) => number; format: (value: number) => string }) {
  return (
    <g>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-ink-100" strokeWidth={1} />
          <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" className="fill-ink-500 text-[11px] font-bold">
            {format(tick)}
          </text>
        </g>
      ))}
    </g>
  );
}

function SessionsChart({ rows }: { rows: WeekRow[] }) {
  const { t } = useI18n();
  const label = useWeekLabel();
  const describe = useWeekDescriptions();
  const [active, setActive] = useState<number | null>(null);
  const slot = PLOT_W / rows.length;
  const barW = Math.min(36, slot - 6);
  const y = (value: number) => PAD.top + PLOT_H - (value / 100) * PLOT_H;
  const labelEvery = Math.ceil(rows.length / 8);

  return (
    <figure className="grid gap-2">
      <figcaption className="font-display text-lg font-bold">{t('Planned sessions done each week')}</figcaption>
      <div className="relative">
        {active !== null ? <Tooltip x={PAD.left + slot * active + slot / 2} text={`${label(rows[active])}: ${describe.sessions(rows[active])}`} /> : null}
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('Bar chart of the share of due sessions done per week. The table view lists the same values.')}>
          <Axis ticks={[0, 50, 100]} y={y} format={(value) => `${value}%`} />
          {rows.map((row, index) => {
            const cx = PAD.left + slot * index + slot / 2;
            const value = row.adherencePercent;
            return (
              <g
                key={row.weekStart}
                tabIndex={0}
                role="button"
                aria-label={`${label(row)}: ${describe.sessions(row)}`}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="outline-none focus-visible:[&>rect.hit]:stroke-brand-700"
              >
                <rect className="hit" x={cx - slot / 2 + 1} y={PAD.top} width={slot - 2} height={PLOT_H} fill="transparent" strokeWidth={2} rx={6} />
                {value !== null ? (
                  <rect x={cx - barW / 2} y={y(Math.max(value, 1))} width={barW} height={Math.max(PLOT_H - (y(Math.max(value, 1)) - PAD.top), 2)} rx={4} className="fill-brand-500" />
                ) : row.status === 'not-applicable' ? (
                  <text x={cx} y={PAD.top + PLOT_H - 6} textAnchor="middle" className="fill-ink-500 text-[10px] font-extrabold">
                    {t('N/A')}
                  </text>
                ) : null}
                {index % labelEvery === 0 || index === rows.length - 1 ? (
                  <text x={cx} y={H - 8} textAnchor="middle" className="fill-ink-500 text-[11px] font-bold">
                    {formatShort(row.weekStart)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-xs text-ink-500">{t('N/A = a week with only rest days or an approved pause. Today and later sessions are not counted until they are due.')}</p>
    </figure>
  );
}

function PainChart({ rows }: { rows: WeekRow[] }) {
  const { t } = useI18n();
  const label = useWeekLabel();
  const describe = useWeekDescriptions();
  const [active, setActive] = useState<number | null>(null);
  const slot = PLOT_W / rows.length;
  const y = (value: number) => PAD.top + PLOT_H - (value / 10) * PLOT_H;
  const x = (index: number) => PAD.left + slot * index + slot / 2;
  const labelEvery = Math.ceil(rows.length / 8);

  // Separate line segments so weeks without reports leave a gap instead of a line through 0.
  const segments: string[] = [];
  let current: string[] = [];
  rows.forEach((row, index) => {
    if (row.painAverage === null) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
    } else current.push(`${current.length ? 'L' : 'M'}${x(index)} ${y(row.painAverage)}`);
  });
  if (current.length > 1) segments.push(current.join(' '));

  return (
    <figure className="grid gap-2">
      <figcaption className="font-display text-lg font-bold">{t('Average reported pain (0–10)')}</figcaption>
      <div className="relative">
        {active !== null ? <Tooltip x={x(active)} text={`${label(rows[active])}: ${describe.pain(rows[active])}`} /> : null}
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('Line chart of the average reported pain per week. Weeks without reports are gaps. The table view lists the same values.')}>
          <Axis ticks={[0, 5, 10]} y={y} format={(value) => String(value)} />
          {segments.map((d) => (
            <path key={d} d={d} className="stroke-coral-500" strokeWidth={2} fill="none" strokeLinejoin="round" />
          ))}
          {rows.map((row, index) => (
            <g
              key={row.weekStart}
              tabIndex={0}
              role="button"
              aria-label={`${label(row)}: ${describe.pain(row)}`}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              className="outline-none focus-visible:[&>rect]:stroke-brand-700"
            >
              <rect x={x(index) - slot / 2 + 1} y={PAD.top} width={slot - 2} height={PLOT_H} fill="transparent" strokeWidth={2} rx={6} />
              {row.painAverage !== null ? <circle cx={x(index)} cy={y(row.painAverage)} r={5} className="fill-coral-500 stroke-white" strokeWidth={2} /> : null}
              {index % labelEvery === 0 || index === rows.length - 1 ? (
                <text x={x(index)} y={H - 8} textAnchor="middle" className="fill-ink-500 text-[11px] font-bold">
                  {formatShort(row.weekStart)}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
      <p className="text-xs text-ink-500">{t('Pain scores come from finished exercises. A gap means no score was reported that week.')}</p>
    </figure>
  );
}

const dash = '—';

export function WeeksTable({ rows, showCheckIns = true }: { rows: WeekRow[]; showCheckIns?: boolean }) {
  const { t } = useI18n();
  const describe = useWeekDescriptions();
  const answer = (value: number | null | undefined, max: number) => (value === null || value === undefined ? t('No answer') : `${value}/${max}`);
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full min-w-[640px] text-start text-sm">
        <caption className="sr-only">{t('Weekly summary')}</caption>
        <thead className="text-ink-500">
          <tr className="border-b-2 border-ink-100">
            <th scope="col" className="py-2 pe-3 text-start font-extrabold">{t('Week')}</th>
            <th scope="col" className="py-2 pe-3 text-start font-extrabold">{t('Sessions')}</th>
            <th scope="col" className="py-2 pe-3 text-start font-extrabold">{t('Done %')}</th>
            <th scope="col" className="py-2 pe-3 text-start font-extrabold">{t('Pain (average of reports)')}</th>
            {showCheckIns ? (
              <>
                <th scope="col" className="py-2 pe-3 text-start font-extrabold">{t('Check-in: typical / worst pain')}</th>
                <th scope="col" className="py-2 pe-3 text-start font-extrabold">{t('Activity limits')}</th>
                <th scope="col" className="py-2 pe-3 text-start font-extrabold">{t('Confidence')}</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((row) => (
            <tr key={row.weekStart} className="border-b border-ink-100 align-top">
              <th scope="row" className="py-2 pe-3 text-start font-bold">
                {formatShort(row.weekStart)} – {formatShort(row.weekEnd)}
              </th>
              <td className="py-2 pe-3">{describe.sessions(row)}</td>
              <td className="py-2 pe-3 font-bold">{row.adherencePercent === null ? (row.status === 'not-applicable' ? t('Not applicable') : dash) : `${row.adherencePercent}%`}</td>
              <td className="py-2 pe-3">{row.painAverage === null ? t('No reports') : `${formatNumber(row.painAverage, 1)} (${t('{count} reports', { count: row.painReports })})`}</td>
              {showCheckIns ? (
                <>
                  <td className="py-2 pe-3">{row.checkIn ? `${answer(row.checkIn.painTypical, 10)} / ${answer(row.checkIn.painWorst, 10)}` : t('No check-in')}</td>
                  <td className="py-2 pe-3">{row.checkIn ? answer(row.checkIn.activityLimit, 10) : dash}</td>
                  <td className="py-2 pe-3">{row.checkIn ? answer(row.checkIn.confidence, 5) : dash}</td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WeeklyTrends({ rows, showCheckIns = true }: { rows: WeekRow[]; showCheckIns?: boolean }) {
  const { t } = useI18n();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className="card grid gap-4 p-5" aria-labelledby="trends-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="trends-title" className="font-display text-xl font-bold">
          {t('Weekly trends')}
        </h2>
        <div role="group" aria-label={t('View')} className="flex gap-1 rounded-2xl bg-ink-50 p-1">
          {(['chart', 'table'] as const).map((option) => (
            <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)} className={`min-h-11 rounded-xl px-4 text-sm font-extrabold ${view === option ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500'}`}>
              {option === 'chart' ? t('Charts') : t('Table')}
            </button>
          ))}
        </div>
      </div>
      {view === 'chart' ? (
        <div className="grid gap-6">
          <SessionsChart rows={rows} />
          <PainChart rows={rows} />
        </div>
      ) : (
        <WeeksTable rows={rows} showCheckIns={showCheckIns} />
      )}
    </section>
  );
}
