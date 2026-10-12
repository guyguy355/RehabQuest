import { Loader2, MessageSquare, Send } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, getAuthHeaders } from '../../auth/session';
import { apiBaseUrl } from '../../config/api';

type ThreadUser = {
  id: string;
  name?: string | null;
  email: string;
};

type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
  sender: ThreadUser;
};

type MessageThreadProps = {
  userId: string;
  title: string;
  subtitle?: string;
};

export function MessageThread({ userId, title, subtitle }: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  async function loadMessages() {
    if (!userId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setMessage('');
    setIsError(false);

    try {
      const response = await apiFetch(`${apiBaseUrl}/messages/${userId}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? 'Could not load messages');
        setIsError(true);
        return;
      }

      setMessages(data.messages ?? []);
    } catch {
      setMessage('Could not reach the RehabQuest API');
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMessages();
  }, [userId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsError(false);
    setIsSending(true);

    try {
      const response = await apiFetch(`${apiBaseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          receiverId: userId,
          text,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? 'Could not send message');
        setIsError(true);
        return;
      }

      setText('');
      setMessages((current) => [...current, data.message]);
    } catch {
      setMessage('Could not reach the RehabQuest API');
      setIsError(true);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-container/20 text-primary">
          <MessageSquare className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Messages</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm font-semibold text-on-surface-variant">{subtitle}</p> : null}
        </div>
      </div>

      {message ? (
        <p
          className={[
            'mb-4 rounded-xl px-4 py-3 text-sm font-semibold',
            isError ? 'border border-red-200 bg-red-50 text-red-700' : 'bg-surface-container-low text-on-surface-variant',
          ].join(' ')}
        >
          {message}
        </p>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl bg-surface-container-low p-8 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 font-semibold text-on-surface-variant">Loading messages</p>
        </div>
      ) : messages.length > 0 ? (
        <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1">
          {messages.map((item) => (
            <article key={item.id} className="rounded-2xl bg-surface-container-low px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-on-surface">{item.sender.name || item.sender.email}</p>
                <p className="text-xs font-semibold text-on-surface-variant">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{item.text}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-container-low p-8 text-center">
          <p className="font-display text-xl font-semibold text-on-surface">No messages yet</p>
          <p className="mt-2 text-sm font-semibold text-on-surface-variant">Send a short note to start the thread.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
        <label className="grid gap-2">
          <span className="sr-only">Message text</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder="Write a note..."
            className="resize-none rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 py-3 text-on-surface outline-none transition placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </label>
        <button
          type="submit"
          disabled={isSending || text.trim().length === 0}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary transition hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send Note
        </button>
      </form>
    </section>
  );
}
