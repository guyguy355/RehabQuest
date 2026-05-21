import { CalendarCheck, HeartPulse, TrendingUp } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { AssignedExercisesSection } from '../components/dashboard/AssignedExercisesSection';
import { BadgePreviewCard } from '../components/dashboard/BadgePreviewCard';
import { DailyGoalCard } from '../components/dashboard/DailyGoalCard';
import { ExercisePreviewCard } from '../components/dashboard/ExercisePreviewCard';
import { JourneyProgressCard } from '../components/dashboard/JourneyProgressCard';
import { NotificationPreferencesCard } from '../components/dashboard/NotificationPreferencesCard';
import { PatientMessagesSection } from '../components/dashboard/PatientMessagesSection';
import { ProgressCard } from '../components/dashboard/ProgressCard';
import { QuestCard } from '../components/dashboard/QuestCard';
import { StreakCard } from '../components/dashboard/StreakCard';
import { patientDashboardData } from '../services/mockPatientDashboard';

export function PatientDashboardPage() {
  const firstName = patientDashboardData.patientName.split(' ')[0];

  return (
    <AppShell>
      <main className="mx-auto grid max-w-[1140px] grid-cols-1 gap-5 px-4 py-6 sm:px-5 sm:py-7 md:grid-cols-12 md:gap-6">
        <section className="flex flex-col items-start justify-between gap-5 md:col-span-12 md:flex-row md:items-center">
          <div className="min-w-0">
            <h1 className="break-words font-display text-[2rem] font-bold leading-tight text-on-background sm:text-[2.45rem] md:text-[2.8rem]">
              Good morning, {firstName}!
            </h1>
            <p className="mt-1 text-base italic text-on-surface-variant sm:text-lg">Consistency is the key to recovery.</p>
            <p className="mt-3 text-sm font-semibold text-on-surface-variant">
              {patientDashboardData.injury} - {patientDashboardData.currentPlan}
            </p>
          </div>
          <StreakCard days={patientDashboardData.streakDays} />
        </section>

        <DailyGoalCard />

        <NotificationPreferencesCard />

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

        <PatientMessagesSection />

        <section className="md:col-span-8">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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
