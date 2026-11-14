import { Flame, Loader2, Medal, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiFetch, getAuthHeaders } from '../../auth/session';
import { apiBaseUrl } from '../../config/api';

type DailySummary = {
  totalDueToday: number;
  completedDueToday: number;
  completionPercentage: number;
  streakDays: number;
};

export function DailyGoalCard() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDailySummary() {
      try {
        const response = await apiFetch(`${apiBaseUrl}/patient/daily-summary`, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok) {
          setMessage(data.message ?? 'Could not load daily goal');
          return;
        }

        setSummary(data);
      } catch {
        setMessage('Could not reach the RehabQuest API');
      } finally {
        setIsLoading(false);
      }
    }

    void loadDailySummary();
  }, []);

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient sm:p-6 md:col-span-12">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary-container px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-on-secondary-container">
            <Medal className="h-4 w-4" />
            Daily Goal
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold text-on-surface">Today’s rehab quest</h2>
          <p className="mt-2 text-sm font-semibold text-on-surface-variant">
            Complete every exercise due today to keep your streak alive.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
          <div className="rounded-2xl bg-surface-container-low p-4">
            <Target className="h-5 w-5 text-primary" />
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-on-surface-variant sm:tracking-[0.14em]">Completed today</p>
            <p className="mt-1 font-display text-2xl font-semibold text-on-surface">
              {isLoading ? '...' : `${summary?.completedDueToday ?? 0}/${summary?.totalDueToday ?? 0}`}
            </p>
          </div>
          <div className="rounded-2xl bg-tertiary-fixed p-4 text-on-tertiary-fixed">
            <Flame className="h-5 w-5 text-tertiary-container" fill="currentColor" />
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em]">Streak</p>
            <p className="mt-1 font-display text-2xl font-semibold">
              {isLoading ? '...' : `${summary?.streakDays ?? 0} days`}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex items-center gap-3 text-sm font-semibold text-on-surface-variant">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading daily goal
          </div>
        ) : message ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {message}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm font-semibold text-on-surface-variant">
              <span>Daily progress</span>
              <span>{summary?.completionPercentage ?? 0}%</span>
            </div>
            <div className="mt-2 h-4 overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-secondary transition-all"
                style={{ width: `${summary?.completionPercentage ?? 0}%` }}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

