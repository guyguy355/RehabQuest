import { Link } from 'react-router-dom';

type PlaceholderPageProps = {
  title: string;
  description: string;
  eyebrow?: string;
};

export function PlaceholderPage({ title, description, eyebrow = 'RehabQuest' }: PlaceholderPageProps) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col">
        <header className="flex flex-col items-start justify-between gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <Link to="/" className="text-lg font-bold text-brand-700">
            RehabQuest
          </Link>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
            Prototype
          </span>
        </header>

        <section className="flex flex-1 items-center py-12">
          <div className="w-full rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/patient/dashboard"
                className="flex min-h-12 items-center justify-center rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-900"
              >
                Patient dashboard
              </Link>
              <Link
                to="/physio/dashboard"
                className="flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-600 hover:text-brand-700"
              >
                Physio dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
