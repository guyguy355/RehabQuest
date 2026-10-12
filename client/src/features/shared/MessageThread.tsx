import { Send } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../../app/api';
import { useCurrentUser } from '../../app/AuthProvider';
import { useApi } from '../../app/useApi';
import { formatDateTime } from '../../ui/format';
import { ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';

type Message = { id: string; senderId: string; receiverId: string; text: string; createdAt: string };

export function MessageThread({ otherUserId, otherName }: { otherUserId: string; otherName: string }) {
  const me = useCurrentUser();
  const { data, error, loading, reload, setData } = useApi<{ messages: Message[] }>(`/messages/${otherUserId}`);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [data]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending || !text.trim()) return;
    setSending(true);
    setSendError('');
    try {
      const { message } = await api<{ message: Message }>('/messages', { method: 'POST', body: { receiverId: otherUserId, text } });
      setData({ messages: [...(data?.messages ?? []), message] });
      setText('');
    } catch (caught) {
      setSendError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-3">
      {loading && !data ? <LoadingBlock rows={2} label="Loading messages" /> : null}
      {error && !data ? <ErrorState message={errorMessage(error)} onRetry={reload} /> : null}
      {data ? (
        data.messages.length === 0 ? (
          <p className="rounded-2xl bg-ink-50 p-4 text-ink-500">No messages yet. Say hello to {otherName}.</p>
        ) : (
          <ol ref={listRef} className="grid max-h-[26rem] gap-2 overflow-y-auto pr-1" aria-label={`Conversation with ${otherName}`}>
            {data.messages.map((message) => {
              const mine = message.senderId === me.id;
              return (
                <li key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-3xl px-4 py-2.5 ${mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border-2 border-ink-100 bg-white'}`}>
                    <p className="sr-only">{mine ? 'You' : otherName} wrote:</p>
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    <p className={`mt-0.5 text-xs font-bold ${mine ? 'text-brand-100' : 'text-ink-500'}`}>{formatDateTime(message.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )
      ) : null}
      <form onSubmit={send} className="flex items-end gap-2">
        <label className="sr-only" htmlFor={`message-${otherUserId}`}>
          Message to {otherName}
        </label>
        <textarea
          id={`message-${otherUserId}`}
          className="field-input min-h-12 flex-1 resize-none"
          rows={1}
          maxLength={2000}
          placeholder={`Message ${otherName}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()} aria-label="Send message">
          {sending ? <Spinner /> : <Send className="h-5 w-5" aria-hidden="true" />}
        </button>
      </form>
      {sendError ? <InlineMessage tone="error">{sendError}</InlineMessage> : null}
    </div>
  );
}
