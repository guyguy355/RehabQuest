import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { BellRing, Loader2, Save } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, getAuthHeaders } from '../../auth/session';
import { apiBaseUrl } from '../../config/api';

const dailyReminderId = 1001;

type NotificationPreference = {
  dailyExerciseRemindersEnabled: boolean;
  reminderTime: string;
};

const defaultPreference: NotificationPreference = {
  dailyExerciseRemindersEnabled: false,
  reminderTime: '09:00',
};

export function NotificationPreferencesCard() {
  const [preference, setPreference] = useState<NotificationPreference>(defaultPreference);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadPreference() {
      try {
        const response = await apiFetch(`${apiBaseUrl}/patient/notification-preferences`, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok) {
          setMessage(data.message ?? 'Could not load reminder settings');
          setIsError(true);
          return;
        }

        setPreference(data.preference ?? defaultPreference);
      } catch {
        setMessage('Could not reach the RehabQuest API');
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    }

    void loadPreference();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsError(false);
    setIsSaving(true);

    try {
      const response = await apiFetch(`${apiBaseUrl}/patient/notification-preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(preference),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? 'Could not save reminder settings');
        setIsError(true);
        return;
      }

      setPreference(data.preference);
      await syncLocalReminder(data.preference);
      setMessage('Reminder settings saved');
    } catch {
      setMessage('Could not save reminder settings');
      setIsError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient sm:p-6 md:col-span-12">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-container/20 text-primary">
          <BellRing className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Reminders</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Exercise reminders</h2>
          <p className="mt-1 text-sm font-semibold text-on-surface-variant">
            Set a daily local reminder for your rehab exercises.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 text-sm font-semibold text-on-surface-variant">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading reminder settings
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="flex min-h-12 items-center gap-3 rounded-xl bg-surface-container-low px-4">
            <input
              type="checkbox"
              checked={preference.dailyExerciseRemindersEnabled}
              onChange={(event) =>
                setPreference((current) => ({
                  ...current,
                  dailyExerciseRemindersEnabled: event.target.checked,
                }))
              }
              className="h-5 w-5 accent-primary"
            />
            <span className="text-sm font-bold text-on-surface">Enable daily reminders</span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-on-surface">Reminder time</span>
            <input
              type="time"
              value={preference.reminderTime}
              onChange={(event) =>
                setPreference((current) => ({
                  ...current,
                  reminderTime: event.target.value,
                }))
              }
              className="h-12 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface shadow-ambient outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </label>

          <button
            type="submit"
            disabled={isSaving}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-sm font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Save
          </button>
        </form>
      )}

      {message ? (
        <p
          className={[
            'mt-4 rounded-xl px-4 py-3 text-sm font-semibold',
            isError ? 'border border-red-200 bg-red-50 text-red-700' : 'bg-surface-container-low text-on-surface-variant',
          ].join(' ')}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}

async function syncLocalReminder(preference: NotificationPreference) {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  await LocalNotifications.cancel({ notifications: [{ id: dailyReminderId }] });

  if (!preference.dailyExerciseRemindersEnabled) {
    return;
  }

  const permission = await LocalNotifications.requestPermissions();

  if (permission.display !== 'granted') {
    throw new Error('Notification permission was not granted');
  }

  const [hour, minute] = preference.reminderTime.split(':').map(Number);

  await LocalNotifications.schedule({
    notifications: [
      {
        id: dailyReminderId,
        title: 'Time for RehabQuest',
        body: 'Complete your daily rehab exercises to keep your streak going.',
        schedule: {
          on: {
            hour,
            minute,
          },
          repeats: true,
        },
      },
    ],
  });
}

