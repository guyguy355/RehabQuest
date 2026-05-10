import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-on-background">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[720px] items-center">
        <section className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-ambient">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Page not found</p>
          <h1 className="mt-3 font-display text-[2.5rem] font-bold leading-tight text-on-background">404</h1>
          <p className="mx-auto mt-3 max-w-md text-lg font-semibold text-on-surface-variant">
            This demo route does not exist yet.
          </p>
          <Link
            to="/"
            className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-base font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98]"
          >
            <Home className="h-5 w-5" strokeWidth={2.2} />
            Back to demo chooser
          </Link>
        </section>
      </div>
    </main>
  );
}
