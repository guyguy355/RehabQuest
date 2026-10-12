import { ShieldAlert } from 'lucide-react';

type SafetyDisclaimerCardProps = {
  text: string;
};

export function SafetyDisclaimerCard({ text }: SafetyDisclaimerCardProps) {
  return (
    <aside className="rounded-2xl border border-tertiary-container/30 bg-tertiary-fixed p-5 text-on-tertiary-fixed shadow-ambient">
      <div className="flex gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/45 text-tertiary">
          <ShieldAlert className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <p className="text-sm font-semibold leading-6">{text}</p>
      </div>
    </aside>
  );
}
