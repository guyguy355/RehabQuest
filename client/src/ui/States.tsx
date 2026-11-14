import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Mascot } from './Mascot';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}

export function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-ink-500">
        <Mascot mood="think" size={88} />
        <p className="font-bold">{label}</p>
      </div>
    </div>
  );
}

export function LoadingBlock({ label = 'Loading…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-3xl bg-ink-100" style={{ opacity: 1 - index * 0.2 }} />
      ))}
    </div>
  );
}

export function ErrorState({ title = 'This did not load', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-start gap-3 border-rose-200 bg-rose-50 p-5">
      <div>
        <p className="font-display text-xl font-bold text-rose-700">{title}</p>
        <p className="mt-1 text-ink-700">{message}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children, action, mood = 'think' }: { title: string; children?: ReactNode; action?: ReactNode; mood?: 'think' | 'wave' | 'calm' }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-8 text-center">
      <Mascot mood={mood} size={84} />
      <p className="font-display text-xl font-bold text-ink-900">{title}</p>
      {children ? <div className="max-w-md text-ink-500">{children}</div> : null}
      {action}
    </div>
  );
}

export function InlineMessage({ tone, children }: { tone: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    success: 'border-brand-200 bg-brand-50 text-brand-800',
    info: 'border-sky-100 bg-sky-50 text-sky-700',
  }[tone];

  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl border-2 px-4 py-3 text-sm font-bold ${styles}`}>
      {children}
    </p>
  );
}
