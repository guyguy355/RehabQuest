import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { DailyQuestHeader } from '../components/quest/DailyQuestHeader';
import { ExerciseTaskCard } from '../components/quest/ExerciseTaskCard';
import { patientDashboardData } from '../services/mockPatientDashboard';

export function DailyQuestPage() {
  const completedCount = patientDashboardData.exercises.filter((exercise) => exercise.status === 'completed').length;
  const totalCount = patientDashboardData.exercises.length;
  return (
    <AppShell>
      <main className="mx-auto max-w-[1140px] px-5 py-7">
        <Link
          to="/patient/dashboard"
          className="inline-flex items-center gap-2 rounded-full text-sm font-semibold text-primary transition hover:text-on-primary-container"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="mt-5">
          <DailyQuestHeader
            plan={patientDashboardData.currentPlan}
            quest={patientDashboardData.todayQuest}
            completed={completedCount}
            total={totalCount}
          />
        </div>

        <section className="mt-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Exercises</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Today's exercises</h2>
            </div>
            <span className="text-sm font-semibold text-on-surface-variant">{totalCount} assigned</span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {patientDashboardData.exercises.map((exercise, index) => (
              <ExerciseTaskCard key={exercise.name} exercise={exercise} index={index} />
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
