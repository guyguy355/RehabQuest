import { Bell, CalendarClock, ClipboardList, HeartHandshake, MessageCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import { useUnread } from '../../app/unread';
import { useI18n } from '../../i18n';
import { formatDateTime } from '../../ui/format';
import { EmptyState, ErrorState, LoadingBlock, Spinner } from '../../ui/States';

type Item = { id: string; kind: 'REMINDER' | 'MESSAGE' | 'REVIEW' | 'PLAN' | 'CARE'; title: string; body: string; link: string | null; createdAt: string; readAt: string | null };
const ICONS = { REMINDER: CalendarClock, MESSAGE: MessageCircle, REVIEW: ClipboardList, PLAN: RefreshCw, CARE: HeartHandshake } as const;

export function NotificationsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const unread = useUnread();
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(next: string | null) {
    setLoading(true);
    setError('');
    try {
      const result = await api<{ notifications: Item[]; nextCursor: string | null }>(`/notifications?limit=20${next ? `&cursor=${next}` : ''}`);
      setItems((current) => (next ? [...current, ...result.notifications] : result.notifications));
      setCursor(result.nextCursor);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(null);
  }, []);

  async function open(item: Item) {
    if (!item.readAt) {
      await api(`/notifications/${item.id}/read`, { method: 'POST' }).catch(() => undefined);
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry)));
      void unread.refresh();
    }
    if (item.link?.startsWith('/')) navigate(item.link);
  }

  async function readAll() {
    await api('/notifications/read-all', { method: 'POST' });
    setItems((current) => current.map((entry) => ({ ...entry, readAt: entry.readAt ?? new Date().toISOString() })));
    void unread.refresh();
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Notifications')}
        title={t('What’s new')}
        actions={
          items.some((item) => !item.readAt) ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={readAll}>
              {t('Mark all as read')}
            </button>
          ) : null
        }
      >
        {t('Reminders, messages and updates from your care team.')}
      </PageHeader>

      {error ? <ErrorState message={error} onRetry={() => void load(null)} /> : null}
      {loading && items.length === 0 ? <LoadingBlock rows={3} label={t('Loading notifications')} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState title={t('Nothing new')} mood="calm">{t('New reminders and messages will appear here.')}</EmptyState> : null}

      {items.length > 0 ? (
        <ul className="grid gap-2">
          {items.map((item) => {
            const Icon = ICONS[item.kind] ?? Bell;
            return (
              <li key={item.id}>
                <button type="button" onClick={() => open(item)} className={`card-raised flex w-full items-start gap-3 p-4 text-start transition hover:border-brand-200 ${item.readAt ? '' : 'border-brand-200 bg-brand-50'}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-brand-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-extrabold">
                      {item.title}
                      {item.readAt ? null : <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">{t('New')}</span>}
                    </span>
                    <span className="block text-sm text-ink-700">{item.body}</span>
                    <span className="block text-xs font-bold text-ink-500">{formatDateTime(item.createdAt)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {cursor ? (
        <button type="button" className="btn btn-secondary justify-self-center" onClick={() => void load(cursor)} disabled={loading}>
          {loading ? <Spinner /> : null} {t('Load older notifications')}
        </button>
      ) : null}
    </div>
  );
}
