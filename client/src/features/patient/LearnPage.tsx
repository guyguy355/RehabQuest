import { BookOpenCheck, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { CardAssignment } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { formatDateTime } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { PlainText } from '../../ui/PlainText';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';

export function useCardStateLabel() {
  const { t } = useI18n();
  return (state: CardAssignment['state']) => ({ unread: t('Not read yet'), read: t('Read'), updated: t('Updated since you read it') })[state];
}

export function EducationCardView({ card, onRead }: { card: CardAssignment; onRead: (card: CardAssignment) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const stateLabel = useCardStateLabel();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setSaving(true);
    setError('');
    try {
      const result = await api<{ card: CardAssignment }>(`/patient/education/${card.id}/read`, { method: 'POST', body: { versionId: card.latest.id } });
      toast(t('Marked as read'), 'success');
      onRead(result.card);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="card grid gap-3 p-5" aria-labelledby={`card-${card.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={`card-${card.id}`} className="font-display text-xl font-bold">
          {card.latest.title}
        </h2>
        <Chip tone={card.state === 'read' ? 'brand' : card.state === 'updated' ? 'sun' : 'neutral'} icon={card.state === 'read' ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : card.state === 'updated' ? <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> : undefined}>
          {stateLabel(card.state)}
        </Chip>
      </div>
      <p className="flex flex-wrap items-center gap-3 text-sm text-ink-500">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-4 w-4" aria-hidden="true" /> {t('About {minutes} min to read', { minutes: card.latest.readingMinutes })}
        </span>
        {card.task ? <span>{t('About: {exercise}', { exercise: card.task.title })}</span> : null}
        <span>{t('Version {n}', { n: card.latest.number })}</span>
      </p>
      {card.note ? (
        <p className="rounded-2xl bg-sky-50 p-3 text-ink-900">
          <span className="font-extrabold text-sky-700">{t('Your therapist’s note:')} </span>
          {card.note}
        </p>
      ) : null}
      <PlainText text={card.latest.body} className="text-ink-900" />
      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      {card.state === 'read' ? (
        <p className="text-sm font-bold text-brand-700">{t('You confirmed reading this version on {date}.', { date: formatDateTime(card.lastRead!.at) })}</p>
      ) : (
        <button type="button" className="btn btn-primary justify-self-start" onClick={() => void confirm()} disabled={saving}>
          {saving ? <Spinner /> : <BookOpenCheck className="h-5 w-5" aria-hidden="true" />} {card.state === 'updated' ? t('I have read the update') : t('I have read this')}
        </button>
      )}
    </article>
  );
}

export function LearnPage() {
  const { t } = useI18n();
  const { data, error, loading, reload, setData } = useApi<{ cards: CardAssignment[] }>('/patient/education');

  if (loading && !data) return <LoadingBlock rows={3} label={t('Loading your cards')} />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!data) return null;
  const open = data.cards.filter((card) => card.state !== 'read').length;

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t('Learn')} title={t('Cards from your therapist')}>
        {open > 0 ? t('{count} cards to read', { count: open }) : t('Short explanations your therapist chose for you.')}
      </PageHeader>
      {data.cards.length === 0 ? (
        <EmptyState title={t('No cards yet')} mood="calm">
          {t('Your therapist can share short explanations about your condition and exercises. They will appear here.')}
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {data.cards.map((card) => (
            <EducationCardView key={card.id} card={card} onRead={(updated) => setData({ cards: data.cards.map((item) => (item.id === updated.id ? updated : item)) })} />
          ))}
        </div>
      )}
    </div>
  );
}
