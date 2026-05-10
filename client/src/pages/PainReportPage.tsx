import { ArrowLeft, CheckCircle2, HeartPulse } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { NotesField } from '../components/pain-report/NotesField';
import { PainScale } from '../components/pain-report/PainScale';
import { SafetyDisclaimerCard } from '../components/pain-report/SafetyDisclaimerCard';
import { getExerciseById } from '../services/mockExercises';

export function PainReportPage() {
  const { exerciseId } = useParams();
  const navigate = useNavigate();
  const exercise = getExerciseById(exerciseId);
  const [selectedPain, setSelectedPain] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedPain === null) {
      return;
    }

    navigate('/patient/quest-completed');
  }

  if (!exercise) {
    return (
      <AppShell>
        <main className="mx-auto max-w-[760px] px-5 py-7">
          <Link to="/patient/quest" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <ArrowLeft className="h-4 w-4" />
            Back to quest
          </Link>
          <section className="mt-5 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 shadow-ambient">
            <h1 className="font-display text-3xl font-bold text-on-surface">Exercise not found</h1>
            <p className="mt-2 text-on-surface-variant">Choose an exercise from today’s rehab quest.</p>
          </section>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[920px] px-5 py-7">
        <Link
          to={`/patient/exercise/${exercise.id}`}
          className="inline-flex items-center gap-2 rounded-full text-sm font-semibold text-primary transition hover:text-on-primary-container"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to exercise
        </Link>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-6">
          <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-8">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-container-low text-primary">
                <HeartPulse className="h-7 w-7" strokeWidth={2.1} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Pain Report</p>
                <h1 className="mt-2 font-display text-[2.1rem] font-bold leading-tight text-on-background md:text-[2.65rem]">
                  {exercise.name}
                </h1>
                <p className="mt-2 text-lg font-semibold text-on-surface">How much pain did you feel?</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Pain reports help your physiotherapist monitor your progress.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <PainScale selectedPain={selectedPain} onSelect={setSelectedPain} />
            </div>
          </section>

          <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-8">
            <NotesField value={notes} onChange={setNotes} />
          </section>

          <SafetyDisclaimerCard text="If you feel sharp, unusual, or severe pain, stop and contact your physiotherapist." />

          <button
            type="submit"
            disabled={selectedPain === null}
            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-display text-lg font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none"
          >
            <CheckCircle2 className="h-5 w-5" />
            Submit Pain Report
          </button>
        </form>
      </main>
    </AppShell>
  );
}
