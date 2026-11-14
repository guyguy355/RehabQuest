import { Copy, LogOut, RefreshCw } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../../app/api';
import { useAuth, useCurrentUser } from '../../app/AuthProvider';
import { usePreferences } from '../../app/preferences';
import { PageHeader } from '../../app/Shells';
import type { User } from '../../app/types';
import { useApi } from '../../app/useApi';
import { LanguageSwitch, useI18n } from '../../i18n';
import { Dialog } from '../../ui/Dialog';
import { SelectField } from '../../ui/Field';
import { formatShort } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { ErrorState, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { type MessageContext, MessageThread } from '../shared/MessageThread';
import { ReminderSettings } from './settings/ReminderSettings';

type Therapist = { id: string; name: string; email: string; linkedAt: string; endedAt: string | null; active: boolean };
type Profile = { careCode: string | null; therapists: Therapist[] };

const TIMEZONES = ['Asia/Jerusalem', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'UTC'];

function ComfortSettings() {
  const { t } = useI18n();
  const preferences = usePreferences();
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-extrabold">{t('Language')}</span>
        <LanguageSwitch />
      </div>
      <label className="flex min-h-11 items-center justify-between gap-4 rounded-2xl border-2 border-ink-100 p-4">
        <span>
          <span className="block font-extrabold">{t('Calm mode')}</span>
          <span className="text-sm text-ink-500">{t('Fewer animations and quieter celebrations.')}{preferences.reducedMotion ? ` ${t('Your device already asks for reduced motion.')}` : ''}</span>
        </span>
        <input type="checkbox" className="h-6 w-6 shrink-0 accent-brand-600" checked={preferences.calmMode} onChange={(event) => preferences.update({ calmMode: event.target.checked })} />
      </label>
      <label className="flex min-h-11 items-center justify-between gap-4 rounded-2xl border-2 border-ink-100 p-4">
        <span>
          <span className="block font-extrabold">{t('Sounds')}</span>
          <span className="text-sm text-ink-500">{t('A short chime when a timer ends. Off by default.')}</span>
        </span>
        <input type="checkbox" className="h-6 w-6 shrink-0 accent-brand-600" checked={preferences.soundEnabled} onChange={(event) => preferences.update({ soundEnabled: event.target.checked })} />
      </label>
    </div>
  );
}

export function ProfilePage() {
  const { t } = useI18n();
  const user = useCurrentUser();
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, error, loading, reload, setData } = useApi<Profile>('/patient/profile');
  const [timezone, setTimezone] = useState(user.timezone);
  const [savingTz, setSavingTz] = useState(false);
  const [ending, setEnding] = useState<Therapist | null>(null);
  const [busy, setBusy] = useState(false);
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = [...new Set([user.timezone, browserTz, ...TIMEZONES])];

  async function saveTimezone(event: FormEvent) {
    event.preventDefault();
    setSavingTz(true);
    try {
      const { user: updated } = await api<{ user: User }>('/auth/me', { method: 'PATCH', body: { timezone } });
      auth.updateUser(updated);
      toast(t('Time zone saved'));
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setSavingTz(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast(t('Care code copied'));
    } catch {
      toast(t('Copy is not available here. Select the code instead.'), 'info');
    }
  }

  async function regenerate() {
    setBusy(true);
    try {
      const result = await api<{ careCode: string }>('/patient/care-code/regenerate', { method: 'POST' });
      if (data) setData({ ...data, careCode: result.careCode });
      toast(t('New care code created. The old code no longer works.'));
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function endCare() {
    if (!ending) return;
    setBusy(true);
    try {
      await api(`/patient/therapists/${ending.id}/end-care`, { method: 'POST' });
      toast(t('Care relationship ended'));
      setEnding(null);
      void reload();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t('Profile')} title={user.name}>
        <bdi>{user.email}</bdi>
      </PageHeader>

      {loading && !data ? <LoadingBlock rows={2} /> : null}
      {error && !data ? <ErrorState message={errorMessage(error)} onRetry={reload} /> : null}

      {data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card grid gap-3 p-5" aria-labelledby="care-code">
            <h2 id="care-code" className="font-display text-xl font-bold">
              {t('Your care code')}
            </h2>
            <p className="text-ink-500">{t('Give this code and your email to your therapist. They need both to add you to their patient list.')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <code dir="ltr" className="tabular rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 px-4 py-2 font-display text-3xl font-bold tracking-[0.2em] text-brand-800">
                {data.careCode}
              </code>
              {data.careCode ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyCode(data.careCode!)}>
                  <Copy className="h-4 w-4" aria-hidden="true" /> {t('Copy')}
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost btn-sm" onClick={regenerate} disabled={busy}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t('New code')}
              </button>
            </div>
            <p className="text-xs text-ink-500">{t('Shared it by mistake? Create a new code. Therapists you already work with are not affected.')}</p>
          </section>

          <section className="card grid content-start gap-3 p-5" aria-labelledby="care-team">
            <h2 id="care-team" className="font-display text-xl font-bold">
              {t('Your care team')}
            </h2>
            {data.therapists.length === 0 ? (
              <p className="text-ink-500">{t('No therapist yet. Once your therapist adds you, they appear here.')}</p>
            ) : (
              <ul className="grid gap-2">
                {data.therapists.map((therapist) => (
                  <li key={therapist.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ink-50 p-3">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 font-extrabold">
                        {therapist.name} {therapist.active ? null : <Chip>{t('Ended {date}', { date: formatShort(therapist.endedAt!.slice(0, 10)) })}</Chip>}
                      </p>
                      <p className="text-sm text-ink-500">
                        <bdi>{therapist.email}</bdi>
                      </p>
                    </div>
                    {therapist.active ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEnding(therapist)}>
                        {t('End care relationship')}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card grid gap-3 p-5" aria-labelledby="reminders">
          <h2 id="reminders" className="font-display text-xl font-bold">
            {t('Reminders')}
          </h2>
          <ReminderSettings />
        </section>

        <div className="grid content-start gap-6">
          <section className="card grid gap-3 p-5" aria-labelledby="comfort">
            <h2 id="comfort" className="font-display text-xl font-bold">
              {t('Language and comfort')}
            </h2>
            <ComfortSettings />
          </section>
          <section className="card grid gap-3 p-5" aria-labelledby="tz">
            <h2 id="tz" className="font-display text-xl font-bold">
              {t('Time zone')}
            </h2>
            <p className="text-sm text-ink-500">{t('Your day starts at midnight in this time zone. Exercises count for the day you do them.')}</p>
            <form onSubmit={saveTimezone} className="grid gap-3">
              <SelectField label={t('Time zone')} value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                    {zone === browserTz ? ` (${t('this device')})` : ''}
                  </option>
                ))}
              </SelectField>
              <button type="submit" className="btn btn-secondary justify-self-start" disabled={savingTz || timezone === user.timezone}>
                {savingTz ? <Spinner /> : null} {t('Save time zone')}
              </button>
            </form>
          </section>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-secondary justify-self-start"
        onClick={() => {
          auth.logout();
          navigate('/login', { replace: true });
        }}
      >
        <LogOut className="h-5 w-5 rtl:rotate-180" aria-hidden="true" /> {t('Sign out')}
      </button>

      <Dialog open={ending !== null} onClose={() => setEnding(null)} title={t('End the care relationship?')}>
        <p className="text-ink-700">
          {t('{name} will no longer see your records or be able to message you. Your plan from them is paused. You keep your history and can still read your messages. To work together again, share a care code.', { name: ending?.name ?? '' })}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setEnding(null)}>
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-soft-danger" onClick={endCare} disabled={busy}>
            {busy ? <Spinner /> : null} {t('End care relationship')}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

/** Conversations with the care team. Supports ?with=<therapistId>&context=TASK:<id>&label=... from the session player. */
export function PatientMessagesPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const { data, error, loading, reload } = useApi<{ conversations: { with: { id: string; name: string }; active: boolean; endedAt: string | null; unread: number }[] }>('/messages/conversations');
  const contextParam = params.get('context');
  const initialContext: MessageContext | null = contextParam
    ? { type: contextParam.split(':')[0] as MessageContext['type'], id: contextParam.split(':')[1], label: params.get('label') }
    : null;
  const conversations = data?.conversations ?? [];
  const activeFirst = [...conversations].sort((a, b) => Number(b.active) - Number(a.active));
  const target = params.get('with') ?? activeFirst.find((conversation) => conversation.active)?.with.id;

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t('Messages')} title={t('Your care team')}>
        {t('Questions about your plan? Ask your therapist here. For urgent problems, call your clinic.')}
      </PageHeader>
      {loading && !data ? <LoadingBlock rows={2} /> : null}
      {error && !data ? <ErrorState message={errorMessage(error)} onRetry={reload} /> : null}
      {data && conversations.length === 0 ? <p className="card p-5 text-ink-500">{t('You can message your therapist once they have added you.')}</p> : null}
      {activeFirst.map((conversation) => (
        <section key={conversation.with.id} className="card grid gap-3 p-5" aria-label={t('Messages with {name}', { name: conversation.with.name })}>
          <h2 className="flex flex-wrap items-center gap-2 font-display text-xl font-bold">
            {conversation.with.name}
            {conversation.unread ? <Chip tone="rose">{t('{count} unread', { count: conversation.unread })}</Chip> : null}
          </h2>
          <MessageThread otherUserId={conversation.with.id} otherName={conversation.with.name} initialContext={conversation.with.id === target ? initialContext : null} />
        </section>
      ))}
    </div>
  );
}
