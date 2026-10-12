import { useId } from 'react';
import type { DifficultyRating } from '../../app/types';

// Numeric Rating Scale (NRS) 0–10, the scale physiotherapists use for pain.
const PAIN_COLORS = ['#12A58B', '#2BBFA4', '#5DD6BE', '#96D9A0', '#C9D96B', '#FFD84D', '#FFC81A', '#FF8A5B', '#F26B3A', '#E5484D', '#C9353B'];
const PAIN_WORDS: Record<number, string> = { 0: 'No pain', 2: 'Mild', 5: 'Moderate', 7: 'Severe', 10: 'Worst imaginable' };

export function PainScale({ value, onChange, error }: { value: number | null; onChange: (value: number) => void; error?: string }) {
  const name = useId();

  return (
    <fieldset className="grid gap-2">
      <legend className="field-label mb-1">Pain during the exercise (0–10)</legend>
      <div className="grid grid-cols-11 gap-1 sm:gap-1.5">
        {Array.from({ length: 11 }, (_, level) => {
          const selected = value === level;
          return (
            <label key={level} className="relative">
              <input type="radio" name={name} value={level} checked={selected} onChange={() => onChange(level)} className="peer sr-only" aria-label={`${level}${PAIN_WORDS[level] ? ` – ${PAIN_WORDS[level]}` : ''}`} />
              <span
                className="tabular grid h-12 cursor-pointer place-items-center rounded-xl border-2 text-base font-black transition peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-500 sm:h-14 sm:text-lg"
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
      <div className="flex justify-between text-xs font-bold text-ink-500" aria-hidden="true">
        <span>No pain</span>
        <span>Worst imaginable</span>
      </div>
      {error ? <p className="text-sm font-bold text-rose-700">{error}</p> : null}
    </fieldset>
  );
}

const DIFFICULTY_OPTIONS: { value: DifficultyRating; label: string }[] = [
  { value: 'TOO_EASY', label: 'Too easy' },
  { value: 'JUST_RIGHT', label: 'About right' },
  { value: 'TOO_HARD', label: 'Too hard' },
];

export function DifficultyChoice({ value, onChange }: { value: DifficultyRating | null; onChange: (value: DifficultyRating) => void }) {
  const name = useId();
  return (
    <fieldset className="grid gap-2">
      <legend className="field-label mb-1">
        How hard was it? <span className="font-semibold text-ink-500">(optional)</span>
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {DIFFICULTY_OPTIONS.map((option) => (
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
