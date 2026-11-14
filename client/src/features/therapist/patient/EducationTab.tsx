import { Link } from 'react-router-dom';
import { type FormEvent, useState } from 'react';
import { api, errorMessage } from '../../../app/api';
import type { CardAssignment, LibraryCard, PlanTask } from '../../../app/types';
import { useApi } from '../../../app/useApi';
import { useI18n } from '../../../i18n';
import { SelectField, TextField } from '../../../ui/Field';
import { formatDateTime } from '../../../ui/format';
import { Chip } from '../../../ui/Pills';
import { ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../../ui/States';
import { useToast } from '../../../ui/Toast';
import { useCardStateLabel } from '../../patient/LearnPage';

export function EducationTab({ patientId, tasks }: { patientId: string; tasks: PlanTask[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const stateLabel = useCardStateLabel();
  const assigned = useApi<{ cards: CardAssignment[] }>(`/therapist/patients/${patientId}/education`);
  const library = useApi<{ cards: LibraryCard[] }>('/therapist/education');
  const [cardId, setCardId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if ((assigned.loading && !assigned.data) || (library.loading && !library.data)) return <LoadingBlock rows={3} label={t('Loading cards')} />;
  const failed = assigned.error ?? library.error;
  if (failed && (!assigned.data || !library.data)) return <ErrorState message={errorMessage(failed)} onRetry={() => void Promise.all([assigned.reload(), library.reload()])} />;
  if (!assigned.data || !library.data) return null;
  const assignedIds = new Set(assigned.data.cards.map((card) => card.cardId));
  const available = library.data.cards.filter((card) => !assignedIds.has(card.id));

  async function assign(event: FormEvent) {
    event.preventDefault();
    if (!cardId) {
      setError(t('Choose a card'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`/therapist/patients/${patientId}/education`, { method: 'POST', body: { cardId, taskId: taskId || null, note: note || null } });
      toast(t('Card shared'), 'success');
      setCardId('');
      setTaskId('');
      setNote('');
      await assigned.reload();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/therapist/education-assignments/${id}`, { method: 'DELETE' });
      toast(t('Card removed from this patient'), 'success');
      await assigned.reload();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    }
  }

  return (
    <div className="grid gap-4">
      <section className="card grid gap-3 p-5" aria-labelledby="shared-cards">
        <h2 id="shared-cards" className="font-display text-xl font-bold">
          {t('Shared cards')}
        </h2>
        {assigned.data.cards.length === 0 ? (
          <p className="text-ink-500">{t('No cards shared with this patient yet.')}</p>
        ) : (
          <ul className="grid gap-2">
            {assigned.data.cards.map((card) => (
              <li key={card.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-ink-100 p-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    {card.latest.title} <span className="text-sm font-normal text-ink-500">· {t('Version {n}', { n: card.latest.number })}</span>
                  </p>
                  <p className="text-sm text-ink-500">
                    {card.task ? `${t('Next to: {exercise}', { exercise: card.task.title })} · ` : ''}
                    {card.lastRead ? t('Last confirmed: version {n}, {date}', { n: card.lastRead.versionNumber, date: formatDateTime(card.lastRead.at) }) : t('Shared {date}', { date: formatDateTime(card.assignedAt) })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={card.state === 'read' ? 'brand' : card.state === 'updated' ? 'sun' : 'neutral'}>{stateLabel(card.state)}</Chip>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(card.id)}>
                    {t('Remove')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card grid gap-3 p-5" aria-labelledby="share-card">
        <h2 id="share-card" className="font-display text-xl font-bold">
          {t('Share a card')}
        </h2>
        {library.data.cards.length === 0 ? (
          <p className="text-ink-500">
            {t('You have no cards yet.')}{' '}
            <Link to="/therapist/education" className="font-extrabold text-brand-700 underline-offset-4 hover:underline">
              {t('Write your first card')}
            </Link>
          </p>
        ) : available.length === 0 ? (
          <p className="text-ink-500">{t('All your cards are already shared with this patient.')}</p>
        ) : (
          <form className="grid gap-3" onSubmit={assign} noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label={t('Card')} value={cardId} onChange={(event) => setCardId(event.target.value)}>
                <option value="">{t('Choose…')}</option>
                {available.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.latest.title}
                  </option>
                ))}
              </SelectField>
              <SelectField label={t('Show next to an exercise (optional)')} value={taskId} onChange={(event) => setTaskId(event.target.value)}>
                <option value="">{t('No specific exercise')}</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.exercise.title}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextField label={t('Note for the patient (optional)')} value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} />
            {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
            <button type="submit" className="btn btn-primary justify-self-start" disabled={saving}>
              {saving ? <Spinner /> : null} {t('Share card')}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
