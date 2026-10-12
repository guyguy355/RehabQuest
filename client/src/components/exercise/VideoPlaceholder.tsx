import { PlayCircle } from 'lucide-react';

export function VideoPlaceholder() {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient">
      <div className="grid aspect-video place-items-center rounded-2xl bg-surface-container-low">
        <div className="text-center">
          <PlayCircle className="mx-auto h-14 w-14 text-primary" strokeWidth={1.9} />
          <p className="mt-3 font-display text-xl font-semibold text-on-surface">Video guide</p>
          <p className="mt-1 text-sm text-on-surface-variant">Movement demo placeholder</p>
        </div>
      </div>
    </section>
  );
}
