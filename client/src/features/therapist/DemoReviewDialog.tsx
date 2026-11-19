/**
 * Therapist-side viewer for an exercise's 3D demonstration, with the review decision.
 *
 * - With an `exerciseId`, the physiotherapist can approve or reject the movement (or send it back
 *   to "not reviewed"). Only approved demonstrations reach patients.
 * - Without one (starter catalog preview) it only plays; the decision is made after copying.
 * - Shown in a dialog so there is one WebGL canvas at a time.
 */
import { Check, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../../app/api';
import type { ExerciseDemo as ExerciseDemoData, LibraryExercise } from '../../app/types';
import { useI18n } from '../../i18n';
import { Dialog } from '../../ui/Dialog';
import { Chip } from '../../ui/Pills';
import { InlineMessage, Spinner } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import { ExerciseDemo } from '../demo/ExerciseDemo';

export type DemoReviewStatus = ExerciseDemoData['reviewStatus'];

export function demoStatusLabel(status: DemoReviewStatus, t: (key: string) => string) {
  if (status === 'APPROVED') return t('Approved for patients');
  if (status === 'REJECTED') return t('Rejected');
  return t('Waiting for your review');
}

export function demoStatusTone(status: DemoReviewStatus): 'brand' | 'sun' | 'rose' {
  if (status === 'APPROVED') return 'brand';
  if (status === 'REJECTED') return 'rose';
  return 'sun';
}

type Target = { title: string; demo: ExerciseDemoData; exerciseId?: string };

export function DemoReviewDialog({ target, onClose, onReviewed }: { target: Target | null; onClose: () => void; onReviewed?: (exercise: LibraryExercise) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState<DemoReviewStatus | null>(null);
  const [error, setError] = useState('');

  async function decide(status: DemoReviewStatus) {
    if (!target?.exerciseId || busy) return;
    setBusy(status);
    setError('');
    try {
      const result = await api<{ exercise: LibraryExercise }>(`/therapist/exercises/${target.exerciseId}/demo-review`, { method: 'PATCH', body: { status } });
      toast(status === 'APPROVED' ? t('Demonstration approved. Patients will now see it.') : status === 'REJECTED' ? t('Demonstration rejected. Patients will not see it.') : t('Demonstration sent back for review.'));
      onReviewed?.(result.exercise);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={target !== null} onClose={onClose} title={target ? t('Demonstration: {name}', { name: target.title }) : ''} wide>
      {target ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={demoStatusTone(target.demo.reviewStatus)}>{demoStatusLabel(target.demo.reviewStatus, t)}</Chip>
            <span className="text-sm text-ink-500">
              <bdi dir="ltr">{target.demo.key}</bdi>
            </span>
          </div>

          {/* The player itself: the same component patients see. */}
          <ExerciseDemo key={target.demo.key} demo={target.demo} title={target.title} />

          {target.exerciseId ? (
            <>
              <p className="text-sm text-ink-700">
                {t('Watch the whole loop from both views. Approve it only if the movement matches how you want this exercise done. Patients see the demonstration only after your approval, and an edit to the title or steps sends it back for review.')}
              </p>
              {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
              <div className="flex flex-wrap justify-end gap-2">
                {target.demo.reviewStatus !== 'UNREVIEWED' ? (
                  <button type="button" className="btn btn-secondary" onClick={() => decide('UNREVIEWED')} disabled={busy !== null}>
                    {busy === 'UNREVIEWED' ? <Spinner /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />} {t('Back to not reviewed')}
                  </button>
                ) : null}
                {target.demo.reviewStatus !== 'REJECTED' ? (
                  <button type="button" className="btn btn-soft-danger" onClick={() => decide('REJECTED')} disabled={busy !== null}>
                    {busy === 'REJECTED' ? <Spinner /> : <X className="h-4 w-4" aria-hidden="true" />} {t('Reject')}
                  </button>
                ) : null}
                {target.demo.reviewStatus !== 'APPROVED' ? (
                  <button type="button" className="btn btn-primary" onClick={() => decide('APPROVED')} disabled={busy !== null}>
                    {busy === 'APPROVED' ? <Spinner /> : <Check className="h-4 w-4" aria-hidden="true" />} {t('Approve for patients')}
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-700">{t('This starter exercise comes with a built-in demonstration. After you add it to your library you can approve it so your patients see it.')}</p>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
