/**
 * Comfort preferences: calm mode (fewer animations and celebrations) and optional sounds.
 * Stored on the device and, for signed-in users, saved to the account (/me/preferences) so they
 * follow the person to other devices. <PreferencesSync> loads the account values after sign-in.
 * Calm mode also turns on automatically when the OS asks for reduced motion.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { useAuth } from './AuthProvider';
import { getToken } from './session';

export type Preferences = { calmMode: boolean; soundEnabled: boolean };
const KEY = 'rehabquest.preferences';
const DEFAULTS: Preferences = { calmMode: false, soundEnabled: false };

function read(): Preferences {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Preferences>) };
  } catch {
    return DEFAULTS;
  }
}

type Value = Preferences & { reducedMotion: boolean; calm: boolean; update: (patch: Partial<Preferences>) => void; hydrate: (patch: Partial<Preferences>) => void };
const PreferencesContext = createContext<Value | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(read);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = () => setReducedMotion(query.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  const calm = preferences.calmMode || reducedMotion;
  useEffect(() => {
    document.documentElement.classList.toggle('calm', calm);
  }, [calm]);

  const apply = useCallback((patch: Partial<Preferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const update = useCallback(
    (patch: Partial<Preferences>) => {
      apply(patch);
      // Saving to the account is best effort: the device keeps the setting if the request fails.
      if (getToken()) void api('/me/preferences', { method: 'PATCH', body: patch }).catch(() => undefined);
    },
    [apply],
  );

  const value = useMemo(() => ({ ...preferences, reducedMotion, calm, update, hydrate: apply }), [preferences, reducedMotion, calm, update, apply]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return context;
}

/** Loads the account's comfort settings after sign-in (render inside AuthProvider). */
export function PreferencesSync() {
  const { user } = useAuth();
  const { hydrate } = usePreferences();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    api<{ preference: Preferences }>('/me/preferences', { signal: controller.signal })
      .then(({ preference }) => hydrate({ calmMode: preference.calmMode, soundEnabled: preference.soundEnabled }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [userId, hydrate]);

  return null;
}

/** A short original two-note chime, generated with Web Audio (no audio files). */
export function playChime() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextClass();
    [523.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const start = context.currentTime + index * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.4);
    });
    window.setTimeout(() => void context.close(), 1000);
  } catch {
    // Audio not available: the visual notice is enough.
  }
}
