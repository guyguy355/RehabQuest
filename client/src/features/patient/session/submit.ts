import { api } from '../../../app/api';
import type { CompletionResult, CompletionStatus, DifficultyRating, OutcomeReason } from '../../../app/types';

export type CompletionPayload = {
  status: CompletionStatus;
  painLevel: number | null;
  difficulty: DifficultyRating | null;
  reason: OutcomeReason | null;
  notes: string | null;
  setsCompleted: number | null;
  repsPerSet: number[];
  activeSeconds: number;
  // Binding to the scheduled occurrence; the same key is reused on every retry.
  idempotencyKey: string;
  sessionDate: string;
  planVersionId: string;
  occurredAt: string;
};

/** Sends one outcome. Retrying with the same idempotencyKey never creates a second record or reward. */
export async function submitCompletion(_userId: string, taskId: string, payload: CompletionPayload): Promise<CompletionResult> {
  return api<CompletionResult>(`/patient/tasks/${taskId}/completion`, { method: 'POST', body: payload });
}
