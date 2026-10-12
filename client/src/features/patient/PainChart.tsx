import { useState } from 'react';
import { formatShort } from '../../ui/format';

type Point = { date: string; averagePain: number; completed: number; stopped: number };

/**
 * Average reported pain per session day, on the clinical 0–10 scale.
 * One series → no legend; the heading names it. Each bar has a hover/focus
 * tooltip and the same data is available as a table.
 */
export function PainChart({ points, title = 'Average pain per session day' }: { points: Point[]; title?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const width = 640;
  const height = 200;
  const pad = { top: 12, right: 8, bottom: 26, left: 28 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / Math.max(points.length, 1);
  const barW = Math.max(4, Math.min(28, slot - 2)); // ≥2px gap between bars
  const y = (value: number) => pad.top + plotH - (value / 10) * plotH;
  const labelEvery = Math.ceil(points.length / 7);

  return (
    <figure className="grid gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-xl font-bold">{title}</span>
        <button type="button" className="text-sm font-extrabold text-brand-700 underline-offset-4 hover:underline" onClick={() => setShowTable((value) => !value)} aria-expanded={showTable}>
          {showTable ? 'Show chart' : 'Show as table'}
        </button>
      </figcaption>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="tabular w-full text-left text-sm">
            <thead className="text-ink-500">
              <tr>
                <th className="py-1 pr-4 font-extrabold">Date</th>
                <th className="py-1 pr-4 font-extrabold">Average pain (0–10)</th>
                <th className="py-1 pr-4 font-extrabold">Completed</th>
                <th className="py-1 font-extrabold">Stopped</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date} className="border-t border-ink-100">
                  <td className="py-1.5 pr-4">{formatShort(point.date)}</td>
                  <td className="py-1.5 pr-4 font-bold">{point.averagePain}</td>
                  <td className="py-1.5 pr-4">{point.completed}</td>
                  <td className="py-1.5">{point.stopped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`${title}, ${points.length} days. Use "Show as table" for exact values.`}>
            {[0, 5, 10].map((tick) => (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="#E9EFEF" strokeWidth={tick === 0 ? 2 : 1} />
                <text x={pad.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="central" fontSize="12" fontWeight="700" fill="#5A6C6D" fontFamily="Nunito, sans-serif">
                  {tick}
                </text>
              </g>
            ))}
            {points.map((point, index) => {
              const x = pad.left + index * slot + (slot - barW) / 2;
              const top = y(Math.max(point.averagePain, 0.15));
              const h = pad.top + plotH - top;
              const r = Math.min(4, barW / 2, h);
              const isActive = active === index;
              return (
                <g key={point.date}>
                  {/* rounded top, square bottom anchored to the baseline */}
                  <path
                    d={`M${x},${pad.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + plotH} Z`}
                    fill={isActive ? '#076B5F' : '#12A58B'}
                  />
                  {point.stopped > 0 ? <circle cx={x + barW / 2} cy={top - 7} r="4" fill="#F26B3A" stroke="#fff" strokeWidth="2" /> : null}
                  {index % labelEvery === 0 ? (
                    <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="#5A6C6D" fontFamily="Nunito, sans-serif">
                      {formatShort(point.date)}
                    </text>
                  ) : null}
                  {/* hit target larger than the mark */}
                  <rect
                    x={pad.left + index * slot}
                    y={pad.top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${formatShort(point.date)}: average pain ${point.averagePain}`}
                    onMouseEnter={() => setActive(index)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                  />
                </g>
              );
            })}
          </svg>
          {active !== null ? (
            <div
              className="pointer-events-none absolute -translate-x-1/2 rounded-xl bg-ink-900 px-3 py-2 text-xs font-bold text-white shadow-lg"
              style={{ left: `${((pad.left + active * slot + slot / 2) / width) * 100}%`, top: 0 }}
              aria-hidden="true"
            >
              <p>{formatShort(points[active].date)}</p>
              <p className="tabular">Pain {points[active].averagePain}/10</p>
              {points[active].stopped ? <p className="text-coral-300">Stopped early</p> : null}
            </div>
          ) : null}
          <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-ink-500">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-coral-500" aria-hidden="true" /> Stopped because of symptoms that day
          </p>
        </div>
      )}
    </figure>
  );
}
