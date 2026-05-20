import { CalendarCheck, HeartPulse, TrendingUp } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { AssignedExercisesSection } from '../components/dashboard/AssignedExercisesSection';
import { BadgePreviewCard } from '../components/dashboard/BadgePreviewCard';
import { ExercisePreviewCard } from '../components/dashboard/ExercisePreviewCard';
import { JourneyProgressCard } from '../components/dashboard/JourneyProgressCard';
import { ProgressCard } from '../components/dashboard/ProgressCard';
import { QuestCard } from '../components/dashboard/QuestCard';
import { StreakCard } from '../components/dashboard/StreakCard';
import { patientDashboardData } from '../services/mockPatientDashboard';

export function PatientDashboardPage() {
  const firstName = patientDashboardData.patientName.split(' ')[0];

  return (
    <AppShell>
      <main className="mx-auto grid max-w-[1140px] grid-cols-1 gap-6 px-5 py-7 md:grid-cols-12">
        <section className="flex flex-col items-start justify-between gap-5 md:col-span-12 md:flex-row md:items-center">
          <div>
            <h1 className="font-display text-[2.45rem] font-bold leading-tight text-on-background md:text-[2.8rem]">
              Good morning, {firstName}!
            </h1>
            <p className="mt-1 text-lg italic text-on-surface-variant">Consistency is the key to recovery.</p>
            <p className="mt-3 text-sm font-semibold text-on-surface-variant">
              {patientDashboardData.injury} - {patientDashboardData.currentPlan}
            </p>
          </div>
          <StreakCard days={patientDashboardData.streakDays} />
        </section>

        <QuestCard
          plan={patientDashboardData.currentPlan}
          quest={patientDashboardData.todayQuest}
          progressPercent={patientDashboardData.progressPercent}
          completedExercises={patientDashboardData.completedExercises}
          totalExercises={patientDashboardData.totalExercises}
        />

        <div className="grid gap-6 md:col-span-4 md:grid-rows-3">
          <ProgressCard
            icon={TrendingUp}
            label="Recovery Progress"
            value={`${patientDashboardData.progressPercent}%`}
          />
          <ProgressCard
            icon={HeartPulse}
            label="Average Pain"
            value={`${patientDashboardData.averagePain}/10`}
            tone="blue"
          />
          <ProgressCard
            icon={CalendarCheck}
            label="Next Assessment"
            value={patientDashboardData.nextAssessment}
          />
        </div>

        <JourneyProgressCard steps={patientDashboardData.journey} weekLabel="Week 1 of 4" />

        <AssignedExercisesSection />

        <section className="md:col-span-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Today</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Exercise Preview</h2>
            </div>
            <span className="text-sm font-semibold text-on-surface-variant">
              {patientDashboardData.exercises.length} exercises
            </span>
          </div>
          <div className="grid gap-4">
            {patientDashboardData.exercises.map((exercise) => (
              <ExercisePreviewCard key={exercise.name} exercise={exercise} />
            ))}
          </div>
        </section>

        <section className="md:col-span-4">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Milestones</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Badge Preview</h2>
          </div>
          <div className="grid gap-4">
            {patientDashboardData.badges.map((badge) => (
              <BadgePreviewCard key={badge.title} badge={badge} />
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
