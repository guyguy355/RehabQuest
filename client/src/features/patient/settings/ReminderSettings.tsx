import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { BellOff, BellRing, Clock } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { api, errorMessage } from '../../../app/api';
import { useApi } from '../../../app/useApi';
import { useI18n } from '../../../i18n';
import { serviceWorkerRegistration } from '../../../pwa';
import { TextField } from '../../../ui/Field';
import { formatDateTime } from '../../../ui/format';
import { ErrorState, InlineMessage, LoadingBlock, Spinner } from '../../../ui/States';
import { useToast } from '../../../ui/Toast';

type Preference = {
  dailyExerciseRemindersEnabled: boolean;
  reminderTime: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  snoozedUntil: string | null;
  inAppEnabled: boolean;
  pushEnabled: boolean;
};

const REMINDER_ID = 1001;

// Local reminders only exist in the Android (Capacitor) app.
async function syncNativeReminder(preference: Preference) {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  if (!preference.dailyExerciseRemindersEnabled) return;
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') return;
  const [hour, minute] = preference.reminderTime.split(':').map(Number);
  await LocalNotifications.schedule({ notifications: [{ id: REMINDER_ID, title: 'RehabQuest', body: 'You have a planned session today.', schedule: { on: { hour, minute }, repeats: true } }] });
}

function urlBase64ToBytes(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

type PushState = 'loading' | 'not-configured' | 'unsupported' | 'denied' | 'off' | 'on';

function usePushState(pushEnabled: boolean) {
  const [state, setState] = useState<PushState>('loading');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const config = await api<{ configured: boolean }>('/push/config').catch(() => ({ configured: false }));
      if (cancelled) return;
      if (!config.configured) return setState('not-configured');
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setState('unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      setState(pushEnabled ? 'on' : 'off');
    })();
    return () => {
      cancelled = true;
    };
  }, [pushEnabled]);
  return state;
}

export function ReminderSettings() {
  const { t } = useI18n();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<{ preference: Preference }>('/patient/notification-preferences');
  const [draft, setDraft] = useState<Preference | null>(null);
  const [quiet, setQuiet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const pushState = usePushState(data?.preference.pushEnabled ?? false);

  useEffect(() => {
    if (!data) return;
    setDraft(data.preference);
    setQuiet(Boolean(data.preference.quietHoursStart));
  }, [data]);

  if (loading && !draft) return <LoadingBlock rows={1} label={t('Loading reminder settings')} />;
  if (error && !draft) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (!draft) return null;

  async function save(patch: Partial<Preference> = {}) {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setSaving(true);
    setFields({});
    try {
      const body = {
        dailyExerciseRemindersEnabled: next.dailyExerciseRemindersEnabled,
        reminderTime: next.reminderTime,
        quietHoursStart: quiet ? next.quietHoursStart ?? '22:00' : null,
        quietHoursEnd: quiet ? next.quietHoursEnd ?? '07:00' : null,
        inAppEnabled: next.inAppEnabled,
        pushEnabled: next.pushEnabled,
      };
      const result = await api<{ preference: Preference }>('/patient/notification-preferences', { method: 'PATCH', body });
      setData(result);
      await syncNativeReminder(result.preference).catch(() => undefined);
      toast(t('Reminder settings saved'));
    } catch (caught) {
      const message = errorMessage(caught);
      setFields({ form: message });
    } finally {
      setSaving(false);
    }
  }

  async function snooze(until: '1h' | '3h' | 'tomorrow' | 'off') {
    try {
      const result = await api<{ preference: Preference }>('/patient/notification-preferences/snooze', { method: 'POST', body: { until } });
      setData(result);
      toast(until === 'off' ? t('Snooze cancelled') : t('Reminders snoozed'));
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    }
  }

  async function enablePush() {
    setPushBusy(true);
    setPushMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushMessage(t('Notifications were not allowed. You will still see reminders inside the app.'));
        return;
      }
      const registration = await serviceWorkerRegistration();
      if (!registration) {
        setPushMessage(t('Push needs the installed app or a production build (the service worker is not active here). In-app reminders still work.'));
        return;
      }
      const config = await api<{ publicKey: string }>('/push/config');
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(config.publicKey) });
      const json = subscription.toJSON();
      await api('/push/subscriptions', { method: 'POST', body: { endpoint: json.endpoint, keys: json.keys } });
      await save({ pushEnabled: true });
    } catch (caught) {
      setPushMessage(caught instanceof Error && !('status' in caught) ? t('This browser could not turn on push notifications. In-app reminders still work.') : errorMessage(caught));
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      const registration = await serviceWorkerRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api('/push/subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } }).catch(() => undefined);
        await subscription.unsubscribe().catch(() => undefined);
      }
      await save({ pushEnabled: false });
    } finally {
      setPushBusy(false);
    }
  }

  const snoozed = draft.snoozedUntil && new Date(draft.snoozedUntil) > new Date();

  return (
    <div className="grid gap-4">
      <form
        className="grid gap-4"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="flex min-h-11 items-center justify-between gap-4 rounded-2xl border-2 border-ink-100 p-4">
          <span>
            <span className="block font-extrabold">{t('Daily reminder on training days')}</span>
            <span className="text-sm text-ink-500">{t('No reminders on rest days, during a pause, or once today’s exercises have a result.')}</span>
          </span>
          <input type="checkbox" className="h-6 w-6 shrink-0 accent-brand-600" checked={draft.dailyExerciseRemindersEnabled} onChange={(event) => setDraft({ ...draft, dailyExerciseRemindersEnabled: event.target.checked })} />
        </label>
        <TextField id="reminder-time" label={t('Reminder time')} type="time" value={draft.reminderTime} onChange={(event) => setDraft({ ...draft, reminderTime: event.target.value })} hint={t('In your time zone. On clock-change days, a time that does not exist moves forward by an hour.')} />

        <label className="flex min-h-11 items-center gap-3 font-bold">
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={quiet} onChange={(event) => setQuiet(event.target.checked)} />
          {t('Quiet hours')}
        </label>
        {quiet ? (
          <div className="grid grid-cols-2 gap-3">
            <TextField id="quiet-start" label={t('From')} type="time" value={draft.quietHoursStart ?? '22:00'} onChange={(event) => setDraft({ ...draft, quietHoursStart: event.target.value })} />
            <TextField id="quiet-end" label={t('Until')} type="time" value={draft.quietHoursEnd ?? '07:00'} onChange={(event) => setDraft({ ...draft, quietHoursEnd: event.target.value })} error={fields.quietHoursEnd} />
            <p className="col-span-2 text-sm text-ink-500">{t('A reminder due during quiet hours waits until they end, or is skipped if they last past midnight.')}</p>
          </div>
        ) : null}

        <label className="flex min-h-11 items-center gap-3 font-bold">
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={draft.inAppEnabled} onChange={(event) => setDraft({ ...draft, inAppEnabled: event.target.checked })} />
          {t('Show reminders in the app’s notification center')}
        </label>

        {fields.form ? <InlineMessage tone="error">{fields.form}</InlineMessage> : null}
        <button type="submit" className="btn btn-secondary justify-self-start" disabled={saving}>
          {saving ? <Spinner /> : null} {t('Save reminder settings')}
        </button>
      </form>

      <div className="grid gap-2 rounded-2xl bg-ink-50 p-4">
        <p className="flex items-center gap-2 font-extrabold">
          <Clock className="h-5 w-5 text-ink-500" aria-hidden="true" /> {snoozed ? t('Snoozed until {time}', { time: formatDateTime(draft.snoozedUntil!) }) : t('Snooze reminders')}
        </p>
        <div className="flex flex-wrap gap-2">
          {snoozed ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => snooze('off')}>
              {t('Cancel snooze')}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => snooze('1h')}>{t('1 hour')}</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => snooze('3h')}>{t('3 hours')}</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => snooze('tomorrow')}>{t('Until tomorrow')}</button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl border-2 border-ink-100 p-4" aria-live="polite">
        <p className="flex items-center gap-2 font-extrabold">
          {pushState === 'on' ? <BellRing className="h-5 w-5 text-brand-600" aria-hidden="true" /> : <BellOff className="h-5 w-5 text-ink-500" aria-hidden="true" />}
          {t('Push notifications on this device')}
        </p>
        <p className="text-sm text-ink-500">{t('The lock screen only shows a general message, never exercise names or symptoms.')}</p>
        {pushState === 'loading' ? <Spinner /> : null}
        {pushState === 'not-configured' ? <p className="text-sm font-bold text-ink-700">{t('Push is not set up on this server. In-app reminders still work.')}</p> : null}
        {pushState === 'unsupported' ? <p className="text-sm font-bold text-ink-700">{t('This browser does not support push notifications. In-app reminders still work.')}</p> : null}
        {pushState === 'denied' ? <p className="text-sm font-bold text-ink-700">{t('Notifications are blocked in your browser settings. In-app reminders still work.')}</p> : null}
        {pushState === 'off' ? (
          <button type="button" className="btn btn-secondary btn-sm justify-self-start" onClick={enablePush} disabled={pushBusy}>
            {pushBusy ? <Spinner className="h-4 w-4" /> : null} {t('Turn on push notifications')}
          </button>
        ) : null}
        {pushState === 'on' ? (
          <button type="button" className="btn btn-secondary btn-sm justify-self-start" onClick={disablePush} disabled={pushBusy}>
            {t('Turn off push notifications')}
          </button>
        ) : null}
        {pushMessage ? <InlineMessage tone="info">{pushMessage}</InlineMessage> : null}
      </div>

      <DeliveryLog />
    </div>
  );
}

type Delivery = { id: string; channel: 'IN_APP' | 'WEB_PUSH' | 'DEV_LOG'; status: 'SENT' | 'ACCEPTED' | 'FAILED' | 'SKIPPED'; detail: string | null; createdAt: string; notification: { kind: string; title: string; readAt: string | null } | null };

function DeliveryLog() {
  const { t } = useI18n();
  const { data } = useApi<{ deliveries: Delivery[] }>('/notifications/deliveries');
  if (!data || data.deliveries.length === 0) return null;
  const channel = { IN_APP: t('In the app'), WEB_PUSH: t('Push'), DEV_LOG: t('Development log') };
  const status = { SENT: t('Stored'), ACCEPTED: t('Accepted by the push service'), FAILED: t('Failed'), SKIPPED: t('Skipped') };
  return (
    <details className="rounded-2xl border-2 border-ink-100 p-4">
      <summary className="min-h-11 cursor-pointer font-extrabold">{t('Recent delivery attempts')}</summary>
      <p className="mt-2 text-sm text-ink-500">{t('“Accepted” means the push service took the message. It does not prove your device showed it.')}</p>
      <ul className="mt-2 grid gap-1 text-sm">
        {data.deliveries.map((delivery) => (
          <li key={delivery.id} className="flex flex-wrap justify-between gap-2 border-t border-ink-100 pt-1">
            <span>
              {channel[delivery.channel]} · {status[delivery.status]}
              {delivery.notification?.readAt ? ` · ${t('Read')}` : ''}
            </span>
            <span className="text-ink-500">{formatDateTime(delivery.createdAt)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
