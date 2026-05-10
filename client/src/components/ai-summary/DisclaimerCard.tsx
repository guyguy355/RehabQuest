import { ShieldAlert } from 'lucide-react';

export function DisclaimerCard() {
  return (
    <section className="rounded-2xl border border-tertiary-container/30 bg-tertiary-fixed p-5 text-on-tertiary-fixed shadow-ambient">
      <div className="flex gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/45 text-tertiary">
          <ShieldAlert className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <p className="text-sm font-semibold leading-6">
          &ldquo;AI-generated summaries are for informational support only and do not replace professional medical
          judgment.&rdquo;
        </p>
      </div>
    </section>
  );
}
