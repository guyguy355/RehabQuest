import { ArrowLeft, ClipboardCopy, FilePlus2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PhysioShell } from '../components/PhysioShell';
import { AdherenceStatsCard } from '../components/ai-summary/AdherenceStatsCard';
import { DisclaimerCard } from '../components/ai-summary/DisclaimerCard';
import { DiscussionPointsCard } from '../components/ai-summary/DiscussionPointsCard';
import { GeneratedSummaryCard } from '../components/ai-summary/GeneratedSummaryCard';
import { PainTrendSummaryCard } from '../components/ai-summary/PainTrendSummaryCard';
import { PatientContextCard } from '../components/ai-summary/PatientContextCard';
import { RecentNotesCard } from '../components/ai-summary/RecentNotesCard';
import { aiProgressSummary } from '../services/mockAISummary';

export function AIProgressSummaryPage() {
  const { patientId } = useParams();
  const resolvedPatientId = patientId ?? aiProgressSummary.patientId;
  const [copyMessage, setCopyMessage] = useState('');

  async function handleCopySummary() {
    if (!navigator.clipboard) {
      setCopyMessage('Clipboard is not available in this browser.');
      return;
    }

    try {
      await navigator.clipboard.writeText(aiProgressSummary.summary);
      setCopyMessage('Summary copied to clipboard.');
    } catch {
      setCopyMessage('Unable to copy summary. Please copy it manually.');
    }
  }

  return (
    <PhysioShell>
      <main className="mx-auto max-w-[1140px] px-5 py-7">
        <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-8">
          <Link
            to={`/physio/patients/${resolvedPatientId}`}
            className="inline-flex items-center gap-2 rounded-full text-sm font-semibold text-primary transition hover:text-on-primary-container"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to patient profile
          </Link>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">AI support</p>
            <h1 className="mt-2 font-display text-[2.3rem] font-bold leading-tight text-on-background md:text-[2.9rem]">
              AI Progress Summary
            </h1>
            <p className="mt-2 max-w-2xl text-lg font-semibold text-on-surface-variant">
              Review adherence, pain trends, and discussion points before the next session.
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid content-start gap-6">
            <PatientContextCard patient={aiProgressSummary.patient} />
            <AdherenceStatsCard items={aiProgressSummary.adherence} />
            <PainTrendSummaryCard items={aiProgressSummary.painTrend} />
          </div>

          <div className="grid content-start gap-6">
            <GeneratedSummaryCard summary={aiProgressSummary.summary} />
            <DiscussionPointsCard points={aiProgressSummary.discussionPoints} />
            <RecentNotesCard notes={aiProgressSummary.recentNotes} />
            <DisclaimerCard />

            {copyMessage ? (
              <div className="rounded-2xl bg-secondary-container px-5 py-4 text-sm font-semibold text-on-secondary-container">
                {copyMessage}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={handleCopySummary}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-display text-sm font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98]"
              >
                <ClipboardCopy className="h-4 w-4" strokeWidth={2.2} />
                Copy Summary
              </button>
              <Link
                to={`/physio/patients/${resolvedPatientId}`}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-primary px-4 font-display text-sm font-semibold text-primary transition hover:bg-primary/5"
              >
                <UserRound className="h-4 w-4" strokeWidth={2.2} />
                Back to Patient Profile
              </Link>
              <Link
                to="/physio/plans/new"
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-primary px-4 font-display text-sm font-semibold text-primary transition hover:bg-primary/5"
              >
                <FilePlus2 className="h-4 w-4" strokeWidth={2.2} />
                Create Follow-up Plan
              </Link>
            </div>
          </div>
        </div>
      </main>
    </PhysioShell>
  );
}
