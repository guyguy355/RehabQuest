import { AlertCircle, Link2, RotateCw, Send, X } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../app/api';
import { useCurrentUser } from '../../app/AuthProvider';
import { newId } from '../../app/localData';
import { useUnread } from '../../app/unread';
import { useI18n } from '../../i18n';
import { formatDateTime } from '../../ui/format';
import { ErrorState, LoadingBlock, Spinner } from '../../ui/States';

export type MessageContext = { type: 'TASK' | 'COMPLETION' | 'PLAN' | 'REVIEW_ITEM'; id: string; label?: string | null };
type ServerMessage = { id: string; senderId: string; receiverId: string; text: string; createdAt: string; readAt: string | null; clientMessageId: string | null; context: (MessageContext & { link: string | null; unavailable?: boolean }) | null };
type LocalMessage = ServerMessage & { state?: 'sending' | 'failed'; error?: string };
type Page = { with: { id: string; name: string }; active: boolean; endedAt: string | null; messages: ServerMessage[]; nextBefore: string | null };

const POLL_MS = 10_000;

function mergeById(current: LocalMessage[], incoming: ServerMessage[]) {
  const byKey = new Map<string, LocalMessage>();
  for (const message of current) byKey.set(message.clientMessageId ?? message.id, message);
  for (const message of incoming) byKey.set(message.clientMessageId ?? message.id, message);
  return [...byKey.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * A conversation with one person. Text is always rendered as plain text (React escapes it);
 * links in messages are not turned into HTML.
 */
export function MessageThread({ otherUserId, otherName, initialContext }: { otherUserId: string; otherName: string; initialContext?: MessageContext | null }) {
  const { t } = useI18n();
  const me = useCurrentUser();
  const unread = useUnread();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [meta, setMeta] = useState<Pick<Page, 'active' | 'endedAt' | 'nextBefore'> | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [context, setContext] = useState<MessageContext | null>(initialContext ?? null);
  const listRef = useRef<HTMLOListElement>(null);
  const base = `/messages/${otherUserId}`;

  const markRead = useCallback(async () => {
    await api(`${base}/read`, { method: 'POST' }).catch(() => undefined);
    void unread.refresh();
  }, [base, unread]);

  const loadLatest = useCallback(async () => {
    try {
      const page = await api<Page>(`${base}?limit=30`);
      setMessages((current) => mergeById(current, page.messages));
      setMeta((current) => ({ active: page.active, endedAt: page.endedAt, nextBefore: current?.nextBefore ?? page.nextBefore }));
      setLoadError('');
      if (page.messages.some((message) => message.receiverId === me.id && !message.readAt)) void markRead();
    } catch (caught) {
      setLoadError(errorMessage(caught));
    }
  }, [base, markRead, me.id]);

  useEffect(() => {
    setMessages([]);
    setMeta(null);
    void loadLatest();
    const id = window.setInterval(() => document.visibilityState === 'visible' && void loadLatest(), POLL_MS);
    return () => window.clearInterval(id);
  }, [loadLatest]);

  useEffect(() => setContext(initialContext ?? null), [initialContext]);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  async function loadOlder() {
    if (!meta?.nextBefore) return;
    setLoadingOlder(true);
    try {
      const page = await api<Page>(`${base}?limit=30&before=${meta.nextBefore}`);
      setMessages((current) => mergeById(current, page.messages));
      setMeta((current) => (current ? { ...current, nextBefore: page.nextBefore } : current));
    } catch (caught) {
      setLoadError(errorMessage(caught));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function deliver(message: LocalMessage) {
    setMessages((current) => current.map((entry) => (entry.clientMessageId === message.clientMessageId ? { ...entry, state: 'sending', error: undefined } : entry)));
    try {
      const result = await api<{ message: ServerMessage }>('/messages', {
        method: 'POST',
        // The same clientMessageId is sent on every retry: the server returns the original message.
        body: { receiverId: otherUserId, text: message.text, clientMessageId: message.clientMessageId, context: message.context ? { type: message.context.type, id: message.context.id } : null },
      });
      setMessages((current) => mergeById(current.filter((entry) => entry.clientMessageId !== message.clientMessageId), [result.message]));
    } catch (caught) {
      setMessages((current) => current.map((entry) => (entry.clientMessageId === message.clientMessageId ? { ...entry, state: 'failed', error: errorMessage(caught) } : entry)));
    }
  }

  function send(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    const local: LocalMessage = {
      id: `local-${newId()}`,
      clientMessageId: newId(),
      senderId: me.id,
      receiverId: otherUserId,
      text: body,
      createdAt: new Date().toISOString(),
      readAt: null,
      context: context ? { ...context, label: context.label ?? null, link: null } : null,
      state: 'sending',
    };
    setMessages((current) => [...current, local]);
    setText('');
    setContext(null);
    void deliver(local);
  }

  if (!meta && loadError) return <ErrorState message={loadError} onRetry={() => void loadLatest()} />;
  if (!meta) return <LoadingBlock rows={2} label={t('Loading messages')} />;

  return (
    <div className="grid gap-3">
      {!meta.active ? (
        <p role="status" className="rounded-2xl bg-ink-100 p-3 text-sm font-bold text-ink-700">
          {t('This care relationship has ended. You can read past messages, but new messages cannot be sent.')}
        </p>
      ) : null}

      {meta.nextBefore ? (
        <button type="button" className="btn btn-ghost btn-sm justify-self-center" onClick={loadOlder} disabled={loadingOlder}>
          {loadingOlder ? <Spinner className="h-4 w-4" /> : null} {t('Load earlier messages')}
        </button>
      ) : null}

      {messages.length === 0 ? (
        <p className="rounded-2xl bg-ink-50 p-4 text-ink-500">{t('No messages yet. Say hello to {name}.', { name: otherName })}</p>
      ) : (
        <ol ref={listRef} className="grid max-h-[28rem] gap-2 overflow-y-auto pe-1" aria-label={t('Conversation with {name}', { name: otherName })} aria-live="polite">
          {messages.map((message) => {
            const mine = message.senderId === me.id;
            return (
              <li key={message.clientMessageId ?? message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-3xl px-4 py-2.5 ${mine ? 'rounded-ee-md bg-brand-600 text-white' : 'rounded-es-md border-2 border-ink-100 bg-white'} ${message.state === 'failed' ? 'opacity-80 ring-2 ring-rose-400' : ''}`}>
                  <p className="sr-only">{mine ? t('You wrote:') : t('{name} wrote:', { name: otherName })}</p>
                  {message.context ? (
                    <p className={`mb-1 flex items-center gap-1 text-xs font-extrabold ${mine ? 'text-brand-100' : 'text-sky-700'}`}>
                      <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {message.context.unavailable ? (
                        t('Linked record is no longer available')
                      ) : message.context.link ? (
                        <Link to={message.context.link} className="underline underline-offset-2">
                          {t('About: {label}', { label: message.context.label ?? '' })}
                        </Link>
                      ) : (
                        t('About: {label}', { label: message.context.label ?? '' })
                      )}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  <p className={`mt-0.5 text-xs font-bold ${mine ? 'text-brand-100' : 'text-ink-500'}`}>
                    {message.state === 'sending' ? t('Sending…') : message.state === 'failed' ? t('Not sent') : formatDateTime(message.createdAt)}
                    {mine && !message.state ? ` · ${message.readAt ? t('Read') : t('Delivered to RehabQuest')}` : ''}
                  </p>
                  {message.state === 'failed' ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 font-bold">
                        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> {message.error}
                      </span>
                      <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-white px-3 font-extrabold text-brand-700" onClick={() => void deliver(message)}>
                        <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> {t('Retry')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {meta.active ? (
        <form onSubmit={send} className="grid gap-2">
          {context ? (
            <p className="flex items-center gap-2 justify-self-start rounded-full bg-sky-50 px-3 py-1 text-sm font-bold text-sky-700">
              <Link2 className="h-4 w-4" aria-hidden="true" /> {t('About: {label}', { label: context.label ?? '' })}
              <button type="button" className="grid h-8 w-8 place-items-center rounded-full hover:bg-sky-100" onClick={() => setContext(null)} aria-label={t('Remove the link to this record')}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </p>
          ) : null}
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor={`message-${otherUserId}`}>
              {t('Message to {name}', { name: otherName })}
            </label>
            <textarea
              id={`message-${otherUserId}`}
              className="field-input min-h-12 flex-1 resize-none"
              rows={2}
              maxLength={2000}
              placeholder={t('Message {name}', { name: otherName })}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button type="submit" className="btn btn-primary" disabled={!text.trim()} aria-label={t('Send message')}>
              <Send className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true" />
            </button>
          </div>
          <p className="text-xs text-ink-500">{t('For urgent problems, call your clinic. Messages are not monitored around the clock.')}</p>
        </form>
      ) : null}
    </div>
  );
}
