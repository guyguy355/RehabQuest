import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Copy, LogOut } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../../app/api';
import { useAuth, useCurrentUser } from '../../app/AuthProvider';
import { PageHeader } from '../../app/Shells';
import type { User } from '../../app/types';
import { useApi } from '../../app/useApi';
import { SelectField, TextField } from '../../ui/Field';
import { ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { MessageThread } from '../shared/MessageThread';

type Profile = { careCode: string | null; therapists: { id: string; name: string; email: string; linkedAt: string }[] };
type Reminder = { dailyExerciseRemindersEnabled: boolean; reminderTime: string };

const REMINDER_ID = 1001;

// Local reminders only exist in the Android (Capacitor) app; on the web the preference is just saved.
async function syncLocalReminder(preference: Reminder) {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  if (!preference.dailyExerciseRemindersEnabled) return;
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') throw new Error('Notification permission was not granted');
  const [hour, minute] = preference.reminderTime.split(':').map(Number);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: 'RehabQuest',
        body: 'Your planned exercises are ready when you are.',
        schedule: { on: { hour, minute }, repeats: true },
      },
    ],
  });
}

function ReminderSettings() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ preference: Reminder }>('/patient/notification-preferences');
  const [draft, setDraft] = useState<Reminder | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (data) setDraft(data.preference);
  }, [data]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const { preference } = await api<{ preference: Reminder }>('/patient/notification-preferences', { method: 'PATCH', body: draft });
      setDraft(preference);
      await syncLocalReminder(preference);
      toast('Reminder saved');
    } catch (caught) {
      setSaveError(caught instanceof Error && !('status' in caught) ? caught.message : errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !draft) return <LoadingBlock rows={1} label="Loading reminder" />;
  if (error && !draft) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!draft) return null;

  return (
    <form onSubmit={save} className="grid gap-4">
      <label className="flex items-center justify-between gap-4 rounded-2xl border-2 border-ink-100 p-4">
        <span>
          <span className="block font-extrabold">Daily reminder</span>
          <span className="text-sm text-ink-500">A gentle nudge on training days (Android app only).</span>
        </span>
        <input
          type="checkbox"
          className="h-6 w-6 accent-brand-600"
          checked={draft.dailyExerciseRemindersEnabled}
          onChange={(event) => setDraft({ ...draft, dailyExerciseRemindersEnabled: event.target.checked })}
        />
      </label>
      <TextField label="Reminder time" type="time" value={draft.reminderTime} onChange={(event) => setDraft({ ...draft, reminderTime: event.target.value })} required />
      {saveError ? <InlineMessage tone="error">{saveError}</InlineMessage> : null}
      <button type="submit" className="btn btn-secondary justify-self-start" disabled={saving}>
        {saving ? <Spinner /> : null} Save reminder
      </button>
    </form>
  );
}

const TIMEZONES = ['Asia/Jerusalem', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'UTC'];

export function ProfilePage() {
  const user = useCurrentUser();
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi<Profile>('/patient/profile');
  const [timezone, setTimezone] = useState(user.timezone);
  const [savingTz, setSavingTz] = useState(false);
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = [...new Set([user.timezone, browserTz, ...TIMEZONES])];

  async function saveTimezone(event: FormEvent) {
    event.preventDefault();
    setSavingTz(true);
    try {
      const { user: updated } = await api<{ user: User }>('/auth/me', { method: 'PATCH', body: { timezone } });
      auth.updateUser(updated);
      toast('Time zone saved');
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setSavingTz(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast('Care code copied');
    } catch {
      toast('Copy is not available here. Select the code instead.', 'info');
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Profile" title={user.name}>
        {user.email}
      </PageHeader>

      {loading && !data ? <LoadingBlock rows={2} /> : null}
      {error && !data ? <ErrorState message={errorMessage(error)} onRetry={reload} /> : null}

      {data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card grid gap-3 p-5" aria-labelledby="care-code">
            <h2 id="care-code" className="font-display text-xl font-bold">
              Your care code
            </h2>
            <p className="text-ink-500">Give this code and your email to your therapist. They need both to add you to their patient list.</p>
            <div className="flex items-center gap-3">
              <code className="tabular rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 px-4 py-2 font-display text-3xl font-bold tracking-[0.2em] text-brand-800">{data.careCode}</code>
              {data.careCode ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyCode(data.careCode!)}>
                  <Copy className="h-4 w-4" aria-hidden="true" /> Copy
                </button>
              ) : null}
            </div>
          </section>

          <section className="card grid gap-3 p-5" aria-labelledby="care-team">
            <h2 id="care-team" className="font-display text-xl font-bold">
              Your care team
            </h2>
            {data.therapists.length === 0 ? (
              <p className="text-ink-500">No therapist yet. Once your therapist adds you, they appear here.</p>
            ) : (
              <ul className="grid gap-2">
                {data.therapists.map((therapist) => (
                  <li key={therapist.id} className="rounded-2xl bg-ink-50 p-3">
                    <p className="font-extrabold">{therapist.name}</p>
                    <p className="text-sm text-ink-500">{therapist.email}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card grid gap-3 p-5" aria-labelledby="tz">
          <h2 id="tz" className="font-display text-xl font-bold">
            Time zone
          </h2>
          <p className="text-sm text-ink-500">Your day starts at midnight in this time zone. Exercises count for the day you finish them.</p>
          <form onSubmit={saveTimezone} className="grid gap-3">
            <SelectField label="Time zone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                  {zone === browserTz ? ' (this device)' : ''}
                </option>
              ))}
            </SelectField>
            <button type="submit" className="btn btn-secondary justify-self-start" disabled={savingTz || timezone === user.timezone}>
              {savingTz ? <Spinner /> : null} Save time zone
            </button>
          </form>
        </section>

        <section className="card grid gap-3 p-5" aria-labelledby="reminders">
          <h2 id="reminders" className="font-display text-xl font-bold">
            Reminders
          </h2>
          <ReminderSettings />
        </section>
      </div>

      <button
        type="button"
        className="btn btn-secondary justify-self-start"
        onClick={() => {
          auth.logout();
          navigate('/login', { replace: true });
        }}
      >
        <LogOut className="h-5 w-5" aria-hidden="true" /> Sign out
      </button>
    </div>
  );
}

export function PatientMessagesPage() {
  const { data, error, loading, reload } = useApi<Profile>('/patient/profile');

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Messages" title="Your care team">
        Questions about your plan? Ask your therapist here. For urgent problems, call your clinic.
      </PageHeader>
      {loading && !data ? <LoadingBlock rows={2} /> : null}
      {error && !data ? <ErrorState message={errorMessage(error)} onRetry={reload} /> : null}
      {data && data.therapists.length === 0 ? <p className="card p-5 text-ink-500">You can message your therapist once they have added you.</p> : null}
      {data?.therapists.map((therapist) => (
        <section key={therapist.id} className="card grid gap-3 p-5" aria-label={`Messages with ${therapist.name}`}>
          <h2 className="font-display text-xl font-bold">{therapist.name}</h2>
          <MessageThread otherUserId={therapist.id} otherName={therapist.name} />
        </section>
      ))}
    </div>
  );
}
