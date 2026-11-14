import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { LibraryExercise } from '../../app/types';
import { useI18n } from '../../i18n';
import { SelectField, TextField } from '../../ui/Field';

export type ItemDraft = {
  key: string;
  taskId?: string | null;
  exerciseId: string;
  sets: number;
  reps: number;
  holdSeconds: number | null;
  restSeconds: number | null;
  durationSeconds: number;
  notes: string;
};

let counter = 0;
export const newItemKey = () => `item-${++counter}`;

export function toItemPayload(items: ItemDraft[], includeSlots = true) {
  return items.map(({ key: _key, taskId, notes, ...item }) => ({ ...(includeSlots && taskId ? { taskId } : {}), ...item, notes: notes.trim() || null }));
}

function NumberInput({ id, label, value, min, max, optional, onChange, error }: { id: string; label: string; value: number | null; min: number; max: number; optional?: boolean; onChange: (value: number | null) => void; error?: string }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs font-extrabold text-ink-500">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value === null || Number.isNaN(value) ? '' : value}
        placeholder={optional ? '—' : undefined}
        onChange={(event) => onChange(event.target.value === '' ? (optional ? null : Number.NaN) : event.target.valueAsNumber)}
        className="field-input tabular min-h-11 px-3"
        aria-invalid={error ? true : undefined}
      />
      {error ? <span className="text-xs font-bold text-rose-700">{error}</span> : null}
    </div>
  );
}

/** Ordered list of prescribed exercises: sets, reps, hold, rest, seconds per set and a note. */
export function ItemsEditor({
  items,
  onChange,
  library,
  fields,
  emptyError,
}: {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  library: LibraryExercise[];
  fields: Record<string, string>;
  emptyError?: string;
}) {
  const { t } = useI18n();
  const [pick, setPick] = useState('');
  const byId = new Map(library.map((exercise) => [exercise.id, exercise]));

  const update = (key: string, patch: Partial<ItemDraft>) => onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const move = (index: number, delta: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };
  const add = () => {
    const exercise = byId.get(pick);
    if (!exercise) return;
    onChange([...items, { key: newItemKey(), exerciseId: exercise.id, sets: exercise.sets, reps: exercise.reps, holdSeconds: null, restSeconds: null, durationSeconds: exercise.durationSeconds, notes: '' }]);
    setPick('');
  };

  return (
    <div className="grid gap-3">
      {items.length === 0 ? (
        <p className={`rounded-2xl p-4 text-sm font-bold ${emptyError ? 'bg-rose-50 text-rose-700' : 'bg-ink-50 text-ink-500'}`}>{emptyError ?? t('No exercises yet. Add one below.')}</p>
      ) : null}

      <ol className="grid gap-3">
        {items.map((item, index) => {
          const exercise = byId.get(item.exerciseId);
          const title = exercise?.title ?? t('Exercise');
          const prefix = `item-${item.key}`;
          return (
            <li key={item.key} className="grid gap-3 rounded-3xl border-2 border-ink-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-extrabold">
                  <span className="tabular me-2 text-ink-500">{index + 1}.</span>
                  {title}
                  <span className="ms-2 text-sm font-bold text-ink-500">{exercise?.bodyPart}</span>
                  {item.taskId ? null : <span className="ms-2 rounded-full bg-sun-100 px-2 py-0.5 text-xs font-extrabold text-sun-700">{t('New')}</span>}
                </p>
                <div className="flex gap-1">
                  <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-ink-500 hover:bg-ink-100 disabled:opacity-30" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t('Move {name} up', { name: title })}>
                    <ArrowUp className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-ink-500 hover:bg-ink-100 disabled:opacity-30" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={t('Move {name} down', { name: title })}>
                    <ArrowDown className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-rose-600 hover:bg-rose-50" onClick={() => onChange(items.filter((entry) => entry.key !== item.key))} aria-label={t('Remove {name}', { name: title })}>
                    <Trash2 className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <NumberInput id={`${prefix}-sets`} label={t('Sets')} value={item.sets} min={1} max={20} onChange={(value) => update(item.key, { sets: value ?? Number.NaN })} error={fields[`items.${index}.sets`]} />
                <NumberInput id={`${prefix}-reps`} label={t('Reps')} value={item.reps} min={1} max={100} onChange={(value) => update(item.key, { reps: value ?? Number.NaN })} error={fields[`items.${index}.reps`]} />
                <NumberInput id={`${prefix}-hold`} label={t('Hold (s)')} value={item.holdSeconds} min={0} max={600} optional onChange={(value) => update(item.key, { holdSeconds: value })} error={fields[`items.${index}.holdSeconds`]} />
                <NumberInput id={`${prefix}-rest`} label={t('Rest between sets (s)')} value={item.restSeconds} min={0} max={600} optional onChange={(value) => update(item.key, { restSeconds: value })} error={fields[`items.${index}.restSeconds`]} />
                <NumberInput id={`${prefix}-secs`} label={t('Time per set (s)')} value={item.durationSeconds} min={1} max={3600} onChange={(value) => update(item.key, { durationSeconds: value ?? Number.NaN })} error={fields[`items.${index}.durationSeconds`]} />
              </div>
              <TextField id={`${prefix}-notes`} label={t('Instruction for this patient (optional)')} value={item.notes} maxLength={300} onChange={(event) => update(item.key, { notes: event.target.value })} />
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[14rem] flex-1">
          <SelectField id="add-exercise" label={t('Add from your library')} value={pick} onChange={(event) => setPick(event.target.value)}>
            <option value="">{t('Choose an exercise…')}</option>
            {library.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.title} ({exercise.bodyPart})
              </option>
            ))}
          </SelectField>
        </div>
        <button type="button" className="btn btn-secondary" onClick={add} disabled={!pick}>
          <Plus className="h-5 w-5" aria-hidden="true" /> {t('Add')}
        </button>
      </div>
    </div>
  );
}
