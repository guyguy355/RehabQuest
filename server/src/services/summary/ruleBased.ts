import type { SummaryDataset, SummaryRecord } from './dataset.js';
import type { SummaryContent } from './types.js';

// "Mon 5 Oct": readable, and unambiguous because it is formatted in UTC from a calendar date.
const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const day = (key: string) => dayFormat.format(new Date(`${key}T00:00:00Z`));

const DIFFICULTY_LABEL = { TOO_EASY: 'too easy', JUST_RIGHT: 'about right', TOO_HARD: 'too hard' } as const;

function refs(records: SummaryRecord[]) {
  return records.map((record) => record.ref);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Deterministic summary computed from the same records. Used when no model is
 * configured, the usage limit is reached, or the model fails/returns invalid
 * output. It is always labelled as rule-based, never as an AI response.
 */
export function buildRuleBasedSummary(dataset: SummaryDataset): SummaryContent {
  const { records, sessions, period } = dataset;
  const completed = records.filter((record) => record.status === 'COMPLETED');
  const stopped = records.filter((record) => record.status === 'STOPPED');

  const overview =
    records.length === 0
      ? `No exercise records were submitted between ${day(period.start)} and ${day(period.end)}.`
      : `Between ${day(period.start)} and ${day(period.end)}, ${records.length} exercise record${records.length === 1 ? '' : 's'} were submitted: ${completed.length} completed and ${stopped.length} stopped because of symptoms.`;

  const finishedOrScheduled = sessions.scheduled - sessions.upcoming;
  const adherence =
    sessions.scheduled === 0
      ? 'No sessions were scheduled in this period.'
      : `${sessions.done} of ${finishedOrScheduled} planned session${finishedOrScheduled === 1 ? '' : 's'} up to today were finished; ${sessions.missed} were not finished${sessions.upcoming ? ', and today\'s session is still open' : ''}.`;

  const observations: SummaryContent['observations'] = [];

  if (records.length > 0) {
    const pains = records.map((record) => record.painLevel);
    observations.push({
      text: `Reported pain averaged ${average(pains).toFixed(1)}/10 (lowest ${Math.min(...pains)}, highest ${Math.max(...pains)}).`,
      refs: refs(records),
    });

    if (records.length >= 4) {
      const half = Math.floor(records.length / 2);
      const first = records.slice(0, half);
      const second = records.slice(half);
      const delta = average(second.map((r) => r.painLevel)) - average(first.map((r) => r.painLevel));
      const direction = Math.abs(delta) < 0.5 ? 'about the same in' : delta > 0 ? 'higher in' : 'lower in';
      observations.push({
        text: `Average pain was ${direction} the second half of the period (${average(first.map((r) => r.painLevel)).toFixed(1)} → ${average(second.map((r) => r.painLevel)).toFixed(1)}).`,
        refs: refs(records),
      });
    }

    for (const rating of ['TOO_HARD', 'TOO_EASY'] as const) {
      const matching = records.filter((record) => record.difficulty === rating);
      if (matching.length > 0) {
        observations.push({ text: `Rated "${DIFFICULTY_LABEL[rating]}" ${matching.length} time${matching.length === 1 ? '' : 's'}.`, refs: refs(matching) });
      }
    }

    const withNotes = records.filter((record) => record.note);
    if (withNotes.length > 0) {
      observations.push({ text: `${withNotes.length} record${withNotes.length === 1 ? '' : 's'} include a patient note.`, refs: refs(withNotes) });
    }
  }

  const itemsForReview: SummaryContent['itemsForReview'] = records
    .filter((record) => record.needsReview)
    .slice(0, 8)
    .map((record) => {
      const reasons = [
        record.status === 'STOPPED' ? 'stopped because of symptoms' : null,
        record.painLevel >= 7 ? `pain ${record.painLevel}/10` : null,
        record.difficulty === 'TOO_HARD' ? 'rated too hard' : null,
      ].filter(Boolean);
      return {
        text: `${day(record.date)} · ${record.exercise}: ${reasons.join(', ')}${record.reviewed ? ' (already marked reviewed)' : ''}.`,
        refs: [record.ref],
      };
    });

  return { overview, adherence, observations: observations.slice(0, 6), itemsForReview };
}
