import { useId } from 'react';
import type { DifficultyRating, OutcomeReason } from '../../app/types';
import { useI18n } from '../../i18n';
import { reasonLabel } from '../../ui/format';

// Numeric Rating Scale (NRS) 0–10, the scale physiotherapists use for pain.
const PAIN_COLORS = ['#12A58B', '#2BBFA4', '#5DD6BE', '#96D9A0', '#C9D96B', '#FFD84D', '#FFC81A', '#FF8A5B', '#F26B3A', '#E5484D', '#C9353B'];

export function PainScale({ value, onChange, error, optional = false }: { value: number | null; onChange: (value: number) => void; error?: string; optional?: boolean }) {
  const { t } = useI18n();
  const name = useId();
  const words: Record<number, string> = { 0: t('No pain'), 2: t('Mild'), 5: t('Moderate'), 7: t('Severe'), 10: t('Worst imaginable') };

  return (
    <fieldset className="grid gap-2">
      <legend className="field-label mb-1">
        {t('Pain during the exercise (0–10)')} {optional ? <span className="font-semibold text-ink-500">{t('(optional)')}</span> : null}
      </legend>
      {/* Always left-to-right: 0 is "no pain" on the left in both languages, matching the printed NRS. */}
      <div dir="ltr" className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
        {Array.from({ length: 11 }, (_, level) => {
          const selected = value === level;
          return (
            <label key={level} className="relative">
              <input type="radio" name={name} value={level} checked={selected} onChange={() => onChange(level)} className="peer sr-only" aria-label={`${level}${words[level] ? ` – ${words[level]}` : ''}`} />
              <span
                className="tabular grid min-h-11 cursor-pointer place-items-center rounded-xl border-2 text-base font-black transition peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-500 sm:min-h-14 sm:text-lg"
                style={{
                  borderColor: selected ? '#152A2C' : '#E9EFEF',
                  background: selected ? PAIN_COLORS[level] : '#fff',
                  color: selected && level >= 9 ? '#fff' : '#152A2C',
                  transform: selected ? 'translateY(-2px)' : undefined,
                  boxShadow: selected ? '0 3px 0 0 #152A2C' : `inset 0 -4px 0 0 ${PAIN_COLORS[level]}`,
                }}
              >
                {level}
              </span>
            </label>
          );
        })}
      </div>
      <div dir="ltr" className="flex justify-between text-xs font-bold text-ink-500" aria-hidden="true">
        <span>0 · {t('No pain')}</span>
        <span>10 · {t('Worst imaginable')}</span>
      </div>
      {error ? <p className="text-sm font-bold text-rose-700">{error}</p> : null}
    </fieldset>
  );
}

export function DifficultyChoice({ value, onChange }: { value: DifficultyRating | null; onChange: (value: DifficultyRating) => void }) {
  const { t } = useI18n();
  const name = useId();
  const options: { value: DifficultyRating; label: string }[] = [
    { value: 'TOO_EASY', label: t('Too easy') },
    { value: 'JUST_RIGHT', label: t('About right') },
    { value: 'TOO_HARD', label: t('Too hard') },
  ];
  return (
    <fieldset className="grid gap-2">
      <legend className="field-label mb-1">
        {t('How hard was it?')} <span className="font-semibold text-ink-500">{t('(optional)')}</span>
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <label key={option.value}>
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="peer sr-only" />
            <span className="flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border-2 border-ink-200 bg-white px-2 text-center font-extrabold text-ink-700 transition peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-500">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const SKIP_REASONS: OutcomeReason[] = ['TIRED', 'NO_TIME', 'FORGOT', 'NO_EQUIPMENT', 'UNSURE_HOW', 'PAIN_OR_DISCOMFORT', 'OTHER'];

export function ReasonChoice({ value, onChange, legend }: { value: OutcomeReason | null; onChange: (value: OutcomeReason | null) => void; legend: string }) {
  const { t } = useI18n();
  const name = useId();
  return (
    <fieldset className="grid gap-2">
      <legend className="field-label mb-1">
        {legend} <span className="font-semibold text-ink-500">{t('(optional)')}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {SKIP_REASONS.map((reason) => (
          <label key={reason}>
            <input type="radio" name={name} checked={value === reason} onChange={() => onChange(reason)} onClick={() => value === reason && onChange(null)} className="peer sr-only" />
            <span className="inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-ink-200 bg-white px-4 text-sm font-extrabold text-ink-700 peer-checked:border-grape-400 peer-checked:bg-grape-50 peer-checked:text-grape-700 peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-500">
              {reasonLabel(reason)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
