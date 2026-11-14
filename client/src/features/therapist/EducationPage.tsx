import { History, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { api, ApiError, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { CardDetail, LibraryCard } from '../../app/types';
import { useApi } from '../../app/useApi';
import { useI18n } from '../../i18n';
import { Dialog } from '../../ui/Dialog';
import { TextArea, TextField } from '../../ui/Field';
import { formatDateTime } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { PlainText } from '../../ui/PlainText';
import { EmptyState, ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';

type Draft = { title: string; body: string; readingMinutes: number };

/**
 * Create or edit a card. Saving an existing card publishes a new version; patients with the card are
 * told it changed. A stale editor (someone saved in another window) keeps the text and offers a reload.
 */
function CardEditor({ card, onClose, onSaved }: { card: LibraryCard | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(card ? { title: card.latest.title, body: card.latest.body, readingMinutes: card.latest.readingMinutes } : { title: '', body: '', readingMinutes: 2 });
  const [lockVersion, setLockVersion] = useState(card?.lockVersion ?? 0);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (card) await api(`/therapist/education/${card.id}`, { method: 'PUT', body: { ...draft, lockVersion } });
      else await api('/therapist/education', { method: 'POST', body: draft });
      toast(card ? t('New version published') : t('Card created'), 'success');
      onSaved();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'stale_card') setStale(true);
      else setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function loadLatest() {
    if (!card) return;
    const latest = await api<{ card: CardDetail }>(`/therapist/education/${card.id}`);
    setLockVersion(latest.card.lockVersion);
    setStale(false);
    toast(t('Loaded the latest version number. Your text is unchanged; review it and save again.'), 'info');
  }

  return (
    <Dialog open onClose={onClose} title={card ? t('Edit card') : t('New card')} wide>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        {card ? <InlineMessage tone="info">{t('Saving publishes version {n}. Patients who read the old version are asked to read it again.', { n: card.latest.number + 1 })}</InlineMessage> : null}
        {stale ? (
          <div role="alert" className="grid gap-2 rounded-2xl border-2 border-sun-300 bg-sun-50 p-4">
            <p className="font-extrabold">{t('Someone saved this card in another window.')}</p>
            <p className="text-sm text-ink-700">{t('Your text is still here. Load the latest version number, compare, then save again.')}</p>
            <button type="button" className="btn btn-secondary btn-sm justify-self-start" onClick={() => void loadLatest()}>
              {t('Use the latest version number')}
            </button>
          </div>
        ) : null}
        <TextField label={t('Title')} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={120} />
        <TextField label={t('Reading time (minutes)')} type="number" min={1} max={30} value={draft.readingMinutes} onChange={(event) => setDraft({ ...draft, readingMinutes: Number(event.target.value) })} />
        <div className="flex gap-2" role="group" aria-label={t('Editor view')}>
          <button type="button" aria-pressed={!preview} className={`btn btn-sm ${preview ? 'btn-ghost' : 'btn-secondary'}`} onClick={() => setPreview(false)}>
            {t('Write')}
          </button>
          <button type="button" aria-pressed={preview} className={`btn btn-sm ${preview ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setPreview(true)}>
            {t('Preview as the patient')}
          </button>
        </div>
        {preview ? (
          <div className="rounded-2xl border-2 border-ink-100 p-4">
            <p className="font-display text-xl font-bold">{draft.title || t('Untitled')}</p>
            <PlainText text={draft.body} className="mt-2" />
          </div>
        ) : (
          <TextArea label={t('Text')} hint={t('Plain text. Leave an empty line between paragraphs; start a line with "- " for a bullet.')} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} maxLength={4000} rows={10} />
        )}
        <p className="text-xs text-ink-500">{t('Use general education only. Do not include other patients’ details.')}</p>
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || stale}>
            {saving ? <Spinner /> : null} {card ? t('Publish new version') : t('Create card')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function VersionsDialog({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const { t } = useI18n();
  const { data, error, loading } = useApi<{ card: CardDetail }>(`/therapist/education/${cardId}`);
  return (
    <Dialog open onClose={onClose} title={t('Version history')} wide>
      {loading && !data ? <LoadingBlock rows={2} /> : null}
      {error ? <InlineMessage tone="error">{errorMessage(error)}</InlineMessage> : null}
      <ol className="grid gap-4">
        {data?.card.versions.map((version) => (
          <li key={version.id} className="grid gap-2 rounded-2xl border-2 border-ink-100 p-4">
            <p className="flex flex-wrap items-center gap-2 font-extrabold">
              <Chip>{t('Version {n}', { n: version.number })}</Chip> {version.title}
            </p>
            <p className="text-xs text-ink-500">{t('Published {date}', { date: formatDateTime(version.createdAt) })}</p>
            <PlainText text={version.body} className="text-sm" />
          </li>
        ))}
      </ol>
    </Dialog>
  );
}

export function EducationPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const { data, error, loading, reload } = useApi<{ cards: LibraryCard[] }>(`/therapist/education${showArchived ? '?archived=true' : ''}`);
  const [editing, setEditing] = useState<LibraryCard | 'new' | null>(null);
  const [history, setHistory] = useState<string | null>(null);

  async function archive(card: LibraryCard) {
    try {
      await api(`/therapist/education/${card.id}/archive`, { method: 'POST', body: { archived: !card.archived } });
      toast(card.archived ? t('Card restored') : t('Card archived'), 'success');
      await reload();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Library')}
        title={t('Education cards')}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus className="h-5 w-5" aria-hidden="true" /> {t('New card')}
          </button>
        }
      >
        {t('Short explanations you can share with patients. Every edit is kept as a version.')}
      </PageHeader>
      <label className="flex min-h-11 items-center gap-2 font-bold">
        <input type="checkbox" className="h-5 w-5" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
        {t('Show archived cards')}
      </label>
      {loading && !data ? <LoadingBlock rows={3} label={t('Loading cards')} /> : null}
      {error && !data ? <ErrorState message={errorMessage(error)} onRetry={reload} /> : null}
      {data && data.cards.length === 0 ? (
        <EmptyState title={t('No cards yet')} action={<button className="btn btn-primary" onClick={() => setEditing('new')}>{t('Write your first card')}</button>}>
          {t('For example: why mild soreness after exercise is expected, or how to use ice safely.')}
        </EmptyState>
      ) : null}
      <ul className="grid gap-3 lg:grid-cols-2">
        {data?.cards.map((card) => (
          <li key={card.id} className={`card grid gap-2 p-5 ${card.archived ? 'bg-ink-50' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-display text-xl font-bold">{card.latest.title}</h2>
              <div className="flex flex-wrap gap-1">
                <Chip>{t('Version {n}', { n: card.latest.number })}</Chip>
                {card.archived ? <Chip>{t('Archived')}</Chip> : null}
              </div>
            </div>
            <p className="line-clamp-3 text-sm text-ink-700">{card.latest.body}</p>
            <p className="text-xs font-bold text-ink-500">
              {t('Shared with {count} patients', { count: card.activeAssignments })} · {t('{minutes} min read', { minutes: card.latest.readingMinutes })}
            </p>
            <div className="flex flex-wrap gap-2">
              {!card.archived ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(card)}>
                  {t('Edit')}
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHistory(card.id)}>
                <History className="h-4 w-4" aria-hidden="true" /> {t('Versions')}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void archive(card)}>
                {card.archived ? t('Restore') : t('Archive')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {editing ? <CardEditor card={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => void reload()} /> : null}
      {history ? <VersionsDialog cardId={history} onClose={() => setHistory(null)} /> : null}
    </div>
  );
}
