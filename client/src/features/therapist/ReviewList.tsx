import { CalendarX2, CheckCheck, ClipboardList, Eye, HandHeart, MessageCircle, RotateCcw, Search, Settings2, TrendingDown } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import { useI18n } from '../../i18n';
import { Dialog } from '../../ui/Dialog';
import { TextArea, TextField } from '../../ui/Field';
import { difficultyLabel, formatDateTime, formatDay, outcomeLabel, reasonLabel } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { EmptyState, ErrorState, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';

type Kind = 'FEEDBACK' | 'STOPPED' | 'UNANSWERED_MESSAGE' | 'MISSED_ACTIVITY';
type Item = {
  id: string;
  kind: Kind;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  reasons: string[];
  patient: { id: string; name: string };
  sourceType: string;
  sourceId: string;
  firstEventAt: string;
  lastEventAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  completion: { id: string; exercise: string; sessionDate: string; status: 'COMPLETED' | 'PARTIAL' | 'SKIPPED' | 'STOPPED'; painLevel: number | null; difficulty: 'TOO_EASY' | 'JUST_RIGHT' | 'TOO_HARD' | null; reason: string | null; notes: string | null } | null;
  message: { id: string; text: string; createdAt: string } | null;
};
type Result = { items: Item[]; nextCursor: string | null; countsByKind: Partial<Record<Kind, number>> };
type Settings = { painThreshold: number; flagTooHard: boolean; missedSessionsThreshold: number };

const KIND_ICON = { FEEDBACK: TrendingDown, STOPPED: HandHeart, UNANSWERED_MESSAGE: MessageCircle, MISSED_ACTIVITY: CalendarX2 } as const;

function useKindLabel() {
  const { t } = useI18n();
  return (kind: Kind) => ({ FEEDBACK: t('Feedback'), STOPPED: t('Stopped or skipped for discomfort'), UNANSWERED_MESSAGE: t('Unanswered message'), MISSED_ACTIVITY: t('Missed sessions') })[kind];
}

function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) void api<{ settings: Settings }>('/therapist/review-settings').then((result) => setSettings(result.settings));
  }, [open]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await api('/therapist/review-settings', { method: 'PUT', body: settings });
      toast(t('Review rules saved. They apply to new records.'));
      onClose();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('Review rules')}>
      <p className="text-sm text-ink-700">{t('These rules decide what appears in your queue. They are workflow rules you choose, not medical assessments, and they do not diagnose anything.')}</p>
      {settings ? (
        <form onSubmit={save} className="grid gap-4">
          <TextField id="rule-pain" label={t('Flag pain reports at or above (0–10 scale)')} type="number" min={1} max={10} value={settings.painThreshold} onChange={(event) => setSettings({ ...settings, painThreshold: event.target.valueAsNumber })} />
          <label className="flex min-h-11 items-center gap-3 font-bold">
            <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={settings.flagTooHard} onChange={(event) => setSettings({ ...settings, flagTooHard: event.target.checked })} />
            {t('Flag exercises rated “too hard”')}
          </label>
          <TextField id="rule-missed" label={t('Flag this many planned sessions in a row without a result')} type="number" min={1} max={14} value={settings.missedSessionsThreshold} onChange={(event) => setSettings({ ...settings, missedSessionsThreshold: event.target.valueAsNumber })} hint={t('Rest days and approved pauses are never counted.')} />
          <p className="text-sm text-ink-500">{t('Stopped exercises, skips because of pain, and unanswered patient messages always appear.')}</p>
          <button type="submit" className="btn btn-primary justify-self-end" disabled={saving}>
            {saving ? <Spinner /> : null} {t('Save rules')}
          </button>
        </form>
      ) : (
        <Spinner />
      )}
    </Dialog>
  );
}

function ItemCard({ item, onChanged }: { item: Item; onChanged: (item: Partial<Item> & { id: string }) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const kindLabel = useKindLabel();
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const Icon = KIND_ICON[item.kind] ?? ClipboardList;

  async function act(action: 'acknowledge' | 'resolve' | 'reopen') {
    setBusy(true);
    try {
      const result = await api<{ item: Item }>(`/therapist/review-items/${item.id}/${action}`, { method: 'POST', body: action === 'resolve' ? { note: note.trim() || null } : {} });
      onChanged({ ...result.item, id: item.id });
      toast(action === 'acknowledge' ? t('Marked as seen') : action === 'resolve' ? t('Resolved') : t('Reopened'));
      setResolving(false);
      setNote('');
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  }

  const recordLink = item.completion ? `/therapist/patients/${item.patient.id}?tab=records&record=${item.completion.id}` : null;
  const contextParam = item.completion ? `COMPLETION:${item.completion.id}` : `REVIEW_ITEM:${item.id}`;
  const contextLabel = item.completion ? `${item.completion.exercise} · ${item.completion.sessionDate}` : item.reasons[0];

  return (
    <article className={`card grid gap-3 p-4 ${item.status === 'OPEN' ? 'border-rose-200' : ''}`} aria-labelledby={`item-${item.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-ink-50 text-ink-700">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id={`item-${item.id}`} className="font-display text-lg font-bold leading-tight">
              <Link to={`/therapist/patients/${item.patient.id}`} className="underline-offset-4 hover:underline">
                {item.patient.name}
              </Link>
            </h2>
            <p className="text-sm font-bold text-ink-700">
              {kindLabel(item.kind)} · {formatDateTime(item.lastEventAt)}
            </p>
          </div>
        </div>
        <Chip tone={item.status === 'OPEN' ? 'rose' : item.status === 'ACKNOWLEDGED' ? 'sun' : 'brand'}>
          {item.status === 'OPEN' ? t('Open') : item.status === 'ACKNOWLEDGED' ? t('Seen') : t('Resolved')}
        </Chip>
      </div>

      <div className="rounded-2xl bg-ink-50 p-3">
        <p className="eyebrow">{t('Why this appears')}</p>
        <ul className="mt-1 grid gap-0.5 text-sm font-bold text-ink-900">
          {item.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      {item.completion ? (
        <div className="flex flex-wrap gap-1.5 text-sm">
          <Chip>{item.completion.exercise}</Chip>
          <Chip>{formatDay(item.completion.sessionDate)}</Chip>
          <Chip tone={item.completion.status === 'STOPPED' ? 'coral' : 'brand'}>{outcomeLabel(item.completion.status)}</Chip>
          <Chip>{item.completion.painLevel === null ? t('Pain not reported') : t('Pain {n}/10', { n: item.completion.painLevel })}</Chip>
          {item.completion.difficulty ? <Chip tone="sky">{difficultyLabel(item.completion.difficulty)}</Chip> : null}
          {item.completion.reason ? <Chip tone="grape">{reasonLabel(item.completion.reason)}</Chip> : null}
        </div>
      ) : null}
      {item.completion?.notes ? <p className="whitespace-pre-wrap break-words rounded-2xl border-2 border-ink-100 p-3 italic text-ink-700">“{item.completion.notes}”</p> : null}
      {item.message ? <p className="whitespace-pre-wrap break-words rounded-2xl border-2 border-ink-100 p-3 text-ink-700">“{item.message.text}”</p> : null}

      {item.status === 'RESOLVED' ? (
        <p className="text-sm text-ink-500">
          {t('Resolved {date}', { date: item.resolvedAt ? formatDateTime(item.resolvedAt) : '—' })}
          {item.resolutionNote ? ` · ${item.resolutionNote}` : ''}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {recordLink ? (
          <Link to={recordLink} className="btn btn-ghost btn-sm">
            <Eye className="h-4 w-4" aria-hidden="true" /> {t('Open the record')}
          </Link>
        ) : null}
        <Link to={`/therapist/patients/${item.patient.id}?tab=messages&context=${encodeURIComponent(contextParam)}&label=${encodeURIComponent(contextLabel ?? '')}`} className="btn btn-ghost btn-sm">
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> {item.kind === 'UNANSWERED_MESSAGE' ? t('Reply') : t('Message the patient about this')}
        </Link>
        {item.status === 'OPEN' ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => act('acknowledge')} disabled={busy}>
            {t('Mark as seen')}
          </button>
        ) : null}
        {item.status !== 'RESOLVED' ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setResolving(true)} disabled={busy}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" /> {t('Resolve')}
          </button>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => act('reopen')} disabled={busy}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t('Reopen')}
          </button>
        )}
      </div>

      <Dialog open={resolving} onClose={() => setResolving(false)} title={t('Resolve this item')}>
        <TextArea id={`note-${item.id}`} label={t('Resolution note (optional, visible to you)')} value={note} maxLength={500} rows={3} onChange={(event) => setNote(event.target.value)} hint={t('For example: called the patient, adjusted the plan.')} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setResolving(false)}>
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => act('resolve')} disabled={busy}>
            {busy ? <Spinner /> : null} {t('Resolve')}
          </button>
        </div>
      </Dialog>
    </article>
  );
}

export function ReviewsPage() {
  const { t } = useI18n();
  const kindLabel = useKindLabel();
  const [status, setStatus] = useState<'ACTIVE' | 'RESOLVED'>('ACTIVE');
  const [kind, setKind] = useState<Kind | ''>('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  // Filters can change while a request is in flight; only the newest response may update the list.
  const requestSeq = useRef(0);

  const load = useCallback(
    async (cursor?: string) => {
      const seq = ++requestSeq.current;
      if (!cursor) setResult(null);
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ status, limit: '20' });
        if (kind) params.set('kind', kind);
        if (search) params.set('q', search);
        if (cursor) params.set('cursor', cursor);
        const page = await api<Result>(`/therapist/review-items?${params}`);
        if (seq !== requestSeq.current) return;
        setResult((current) => (cursor && current ? { ...page, items: [...current.items, ...page.items] } : page));
      } catch (caught) {
        if (seq === requestSeq.current) setError(errorMessage(caught));
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [status, kind, search],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  function changed(update: Partial<Item> & { id: string }) {
    setResult((current) => {
      if (!current) return current;
      const items = current.items.map((item) => (item.id === update.id ? { ...item, ...update } : item));
      // Items that moved to the other status view disappear from this one.
      return { ...current, items: items.filter((item) => (status === 'RESOLVED' ? item.status === 'RESOLVED' : item.status !== 'RESOLVED')) };
    });
  }

  const kinds: Kind[] = ['FEEDBACK', 'STOPPED', 'UNANSWERED_MESSAGE', 'MISSED_ACTIVITY'];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Review workspace')}
        title={t('Things to review')}
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => setRulesOpen(true)}>
            <Settings2 className="h-5 w-5" aria-hidden="true" /> {t('Review rules')}
          </button>
        }
      >
        {t('A workflow queue built from your review rules. It does not diagnose or rank risk.')}
      </PageHeader>

      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('Status')}>
          {(['ACTIVE', 'RESOLVED'] as const).map((value) => (
            <button key={value} type="button" aria-pressed={status === value} className={`btn btn-sm ${status === value ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatus(value)}>
              {value === 'ACTIVE' ? t('Open and seen') : t('Resolved')}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('Filter by type')}>
          <button type="button" aria-pressed={kind === ''} className={`btn btn-sm ${kind === '' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setKind('')}>
            {t('All types')}
          </button>
          {kinds.map((value) => (
            <button key={value} type="button" aria-pressed={kind === value} className={`btn btn-sm ${kind === value ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setKind(value)}>
              {kindLabel(value)}
              {result?.countsByKind[value] ? <span className="tabular rounded-full bg-ink-900/10 px-1.5">{result.countsByKind[value]}</span> : null}
            </button>
          ))}
        </div>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute start-3 top-[2.85rem] h-5 w-5 text-ink-400" aria-hidden="true" />
          <TextField id="review-search" label={t('Search by patient name or resolution note')} value={query} onChange={(event) => setQuery(event.target.value)} className="ps-10" />
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {loading && !result ? <LoadingBlock rows={3} label={t('Loading review items')} /> : null}
      {result && result.items.length === 0 && !loading ? (
        <EmptyState title={status === 'RESOLVED' ? t('No resolved items yet') : search || kind ? t('Nothing matches these filters') : t('All caught up')} mood="calm">
          {status === 'RESOLVED' ? t('Items you resolve are kept here with your notes.') : t('New items appear when a patient’s record matches one of your review rules.')}
        </EmptyState>
      ) : null}

      {result && result.items.length > 0 ? (
        <ul className="grid gap-3">
          {result.items.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} onChanged={changed} />
            </li>
          ))}
        </ul>
      ) : null}

      {result?.nextCursor ? (
        <button type="button" className="btn btn-secondary justify-self-center" onClick={() => void load(result.nextCursor!)} disabled={loading}>
          {loading ? <Spinner /> : null} {t('Load more')}
        </button>
      ) : null}

      <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
