import { ArrowRight, ClipboardList, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-on-background">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[980px] flex-col justify-center">
        <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">RehabQuest demo</p>
          <h1 className="mt-3 font-display text-[2.6rem] font-bold leading-tight text-on-background md:text-[3.5rem]">
            Choose your RehabQuest experience
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-semibold leading-7 text-on-surface-variant">
            Explore the patient recovery journey or the physiotherapist dashboard using mock demo data.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <DemoCard
              title="Patient Demo"
              description="Daily quests, exercise details, pain reports, progress, and badges."
              to="/patient/dashboard"
              icon={UserRound}
            />
            <DemoCard
              title="Physiotherapist Demo"
              description="Patient monitoring, care plans, exercise library, and AI summary workflow."
              to="/physio/dashboard"
              icon={ClipboardList}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function DemoCard({
  title,
  description,
  to,
  icon: Icon,
}: {
  title: string;
  description: string;
  to: string;
  icon: typeof UserRound;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5 transition hover:border-primary/40 hover:shadow-ambient-lg active:scale-[0.99]"
    >
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-on-primary">
        <Icon className="h-6 w-6" strokeWidth={2.2} />
      </div>
      <h2 className="mt-5 font-display text-2xl font-semibold text-on-surface">{title}</h2>
      <p className="mt-2 min-h-16 text-sm leading-6 text-on-surface-variant">{description}</p>
      <span className="mt-5 inline-flex items-center gap-2 font-display text-sm font-semibold text-primary">
        Open demo
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
