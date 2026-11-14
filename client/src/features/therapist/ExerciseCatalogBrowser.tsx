import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, errorMessage } from '../../app/api';
import type { CatalogExercise } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { SelectField, TextField } from '../../ui/Field';
import { exerciseDifficultyLabel, formatDuration } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';

const ALL = '';

/** Lets a therapist pick ready-made exercises from the shared starter catalog and copy them into their library. */
export function ExerciseCatalogBrowser({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ exercises: CatalogExercise[] }>('/therapist/exercise-catalog');
  const [bodyPart, setBodyPart] = useState(ALL);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const bodyParts = useMemo(() => [...new Set((data?.exercises ?? []).map((exercise) => exercise.bodyPart))], [data]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.exercises ?? []).filter(
      (exercise) =>
        (bodyPart === ALL || exercise.bodyPart === bodyPart) &&
        (!needle || exercise.title.toLowerCase().includes(needle) || exercise.description.toLowerCase().includes(needle)),
    );
  }, [data, bodyPart, query]);
  const selectable = visible.filter((exercise) => !exercise.inLibrary);
  const allVisibleSelected = selectable.length > 0 && selectable.every((exercise) => selected.has(exercise.key));

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const exercise of selectable) {
        if (allVisibleSelected) next.delete(exercise.key);
        else next.add(exercise.key);
      }
      return next;
    });
  }

  async function addSelected() {
    if (saving || selected.size === 0) return;
    setSaving(true);
    setSaveError('');
    try {
      const result = await api<{ added: number }>('/therapist/exercise-catalog/import', { method: 'POST', body: { keys: [...selected] } });
      toast(t('{count} exercises added to your library', { count: result.added }));
      onAdded();
    } catch (caught) {
      setSaveError(errorMessage(caught));
      setSaving(false);
    }
  }

  if (loading && !data) return <LoadingBlock rows={3} label={t('Loading starter exercises')} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;

  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-500">{t('General starting points, not a diagnosis. Copies go into your library, where you can edit them before using them in a plan.')}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField id="catalog-body" label={t('Body area')} value={bodyPart} onChange={(event) => setBodyPart(event.target.value)}>
          <option value={ALL}>{t('All body areas')}</option>
          {bodyParts.map((part) => (
            <option key={part} value={part}>
              {part}
            </option>
          ))}
        </SelectField>
        <TextField id="catalog-search" label={t('Search')} type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-ink-500">{t('{count} exercises', { count: visible.length })}</p>
        {selectable.length > 0 ? (
          <button type="button" className="btn btn-secondary" onClick={toggleAllVisible}>
            {allVisibleSelected ? t('Clear selection') : t('Select all shown')}
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? <p className="text-ink-500">{t('No starter exercises match your search.')}</p> : null}

      <ul className="grid gap-2">
        {visible.map((exercise) => (
          <li key={exercise.key}>
            <label className={`flex gap-3 rounded-2xl border-2 p-3 ${exercise.inLibrary ? 'border-ink-100 opacity-70' : selected.has(exercise.key) ? 'border-brand-500 bg-brand-50' : 'cursor-pointer border-ink-100 hover:border-ink-200'}`}>
              <input
                type="checkbox"
                className="mt-1 h-6 w-6 shrink-0 accent-brand-600"
                checked={exercise.inLibrary || selected.has(exercise.key)}
                disabled={exercise.inLibrary}
                onChange={() => toggle(exercise.key)}
              />
              <span className="grid min-w-0 gap-1.5">
                <span className="font-display text-lg font-bold leading-tight">{exercise.title}</span>
                <span className="text-sm text-ink-500">{exercise.description}</span>
                <span className="flex flex-wrap gap-1.5">
                  <Chip tone="brand">{exercise.bodyPart}</Chip>
                  <Chip>{exerciseDifficultyLabel(exercise.difficulty)}</Chip>
                  <Chip>
                    <bdi dir="ltr">
                      {exercise.sets} × {exercise.reps}
                    </bdi>{' '}
                    · {formatDuration(exercise.durationSeconds)}
                  </Chip>
                  {exercise.inLibrary ? <Chip tone="grape" icon={<Check className="h-3.5 w-3.5" aria-hidden="true" />}>{t('In your library')}</Chip> : null}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {saveError ? <InlineMessage tone="error">{saveError}</InlineMessage> : null}
      <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t-2 border-ink-100 bg-white p-4 sm:-mx-6 sm:-mb-6 sm:px-6">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {t('Cancel')}
        </button>
        <button type="button" className="btn btn-primary" onClick={addSelected} disabled={saving || selected.size === 0}>
          {saving ? <Spinner /> : null} {t('Add {count} to library', { count: selected.size })}
        </button>
      </div>
    </div>
  );
}
