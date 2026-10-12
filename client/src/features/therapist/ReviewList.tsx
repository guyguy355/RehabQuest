import { CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../app/api';
import { PageHeader } from '../../app/Shells';
import type { Completion } from '../../app/types';
import { useApi } from '../../app/useApi';
import { DIFFICULTY_LABEL, formatDay } from '../../ui/format';
import { Chip } from '../../ui/Pills';
import { EmptyState, ErrorState, LoadingBlock, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';

type ReviewItem = Completion & { patient: { id: string; name: string } };

export function ReviewCard({ item, patientName, onReviewed }: { item: Completion; patientName?: string; onReviewed: (updated: Completion) => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function markReviewed() {
    if (saving) return;
    setSaving(true);
    try {
      const { completion } = await api<{ completion: Completion }>(`/therapist/completions/${item.id}/review`, { method: 'POST' });
      onReviewed(completion);
      toast('Marked as reviewed');
    } catch (caught) {
      toast(errorMessage(caught), 'error');
      setSaving(false);
    }
  }

  return (
    <article className={`card grid gap-3 p-4 ${item.reviewedAt ? "" : "border-rose-200"}`} aria-label={`${item.exercise?.title} on ${formatDay(item.sessionDate)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {patientName ? <p className="font-display text-lg font-bold leading-tight">{patientName}</p> : null}
          <p className="font-bold text-ink-700">
            {item.exercise?.title} · {formatDay(item.sessionDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(item.reviewReasons ?? []).map((reason) => (
            <Chip key={reason} tone="rose">
              {reason}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip tone={item.status === 'STOPPED' ? 'coral' : 'brand'}>{item.status === 'STOPPED' ? 'Stopped' : 'Completed'}</Chip>
        <Chip>Pain {item.painLevel}/10</Chip>
        {item.difficulty ? <Chip tone="sky">{DIFFICULTY_LABEL[item.difficulty]}</Chip> : null}
        <Chip>
          Prescribed {item.prescribed.sets} × {item.prescribed.reps}
        </Chip>
      </div>
      {item.notes ? <p className="rounded-2xl bg-ink-50 p-3 italic text-ink-700">“{item.notes}”</p> : null}
      <div className="flex flex-wrap gap-2">
        {item.reviewedAt ? (
          <Chip tone="brand" icon={<CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />}>
            Reviewed
          </Chip>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={markReviewed} disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" aria-hidden="true" />} Mark reviewed
          </button>
        )}
      </div>
    </article>
  );
}

export function ReviewsPage() {
  const { data, error, loading, reload, setData } = useApi<{ reviews: ReviewItem[] }>('/therapist/reviews');

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Needs review" title="Patient reports">
        Records are flagged by fixed rules: stopped because of symptoms, pain 7/10 or higher, or rated “too hard”. No automatic diagnosis is made.
      </PageHeader>
      {loading && !data ? <LoadingBlock rows={3} label="Loading reports" /> : null}
      {error && !data ? <ErrorState message={errorMessage(error)} onRetry={reload} /> : null}
      {data && data.reviews.length === 0 ? <EmptyState title="All caught up" mood="calm">There are no open reports from your patients.</EmptyState> : null}
      {data && data.reviews.length > 0 ? (
        <ul className="grid gap-3">
          {data.reviews.map((item) => (
            <li key={item.id} className="grid gap-1">
              <ReviewCard item={item} patientName={item.patient.name} onReviewed={() => setData({ reviews: data.reviews.filter((review) => review.id !== item.id) })} />
              <Link to={`/therapist/patients/${item.patient.id}`} className="justify-self-end text-sm font-extrabold text-brand-700 underline-offset-4 hover:underline">
                Open {item.patient.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
