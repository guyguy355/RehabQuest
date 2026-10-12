import { CheckCircle2, Sparkles } from 'lucide-react';

type CelebrationCardProps = {
  title: string;
  subtitle: string;
  message: string;
};

export function CelebrationCard({ title, subtitle, message }: CelebrationCardProps) {
  return (
    <section className="rounded-2xl border border-secondary-container/70 bg-surface-container-lowest p-7 text-center shadow-ambient md:p-10">
      <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-secondary-container text-on-secondary-container shadow-ambient ring-8 ring-secondary-container/30">
        <CheckCircle2 className="h-12 w-12" strokeWidth={2.4} />
      </div>
      <div className="mt-6 flex items-center justify-center gap-2 text-primary">
        <Sparkles className="h-5 w-5" fill="currentColor" />
        <p className="text-xs font-bold uppercase tracking-[0.2em]">Daily quest complete</p>
        <Sparkles className="h-5 w-5" fill="currentColor" />
      </div>
      <h1 className="mt-3 font-display text-[2.5rem] font-bold leading-tight text-on-background md:text-[3.25rem]">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-lg font-semibold text-on-surface-variant">{subtitle}</p>
      <p className="mx-auto mt-6 max-w-xl rounded-2xl bg-surface-container-low px-5 py-4 text-base font-semibold italic text-on-surface">
        {message}
      </p>
    </section>
  );
}
