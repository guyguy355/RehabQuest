import { Check, Lock } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../../../app/api';
import type { Motivation } from '../../../app/types';
import { useI18n } from '../../../i18n';
import { BadgeMedal } from '../../../ui/BadgeMedal';
import { formatDateTime, formatShort } from '../../../ui/format';
import { Mascot } from '../../../ui/Mascot';
import { InlineMessage } from '../../../ui/States';
import { useToast } from '../../../ui/Toast';

export function useCosmeticName() {
  const { t } = useI18n();
  const names: Record<string, string> = {
    classic: t('Classic sweatband'),
    sunband: t('Sunny sweatband'),
    scarf: t('Cosy scarf'),
    cap: t('Blue cap'),
    headphones: t('Headphones'),
    flower: t('Flower'),
    glasses: t('Round glasses'),
    medal: t('Finisher medal'),
  };
  return (id: string) => names[id] ?? id;
}

/** Achievements with their exact rules, the history, and Pip's look collection. */
export function AchievementsPanel({ motivation, onChanged }: { motivation: Motivation; onChanged: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const cosmeticName = useCosmeticName();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const earned = motivation.badges.filter((badge) => badge.earnedAt).length;
  const badgeName = new Map(motivation.badges.map((badge) => [badge.id, badge.name]));

  async function equip(id: string) {
    setSaving(id);
    setError('');
    try {
      await api('/me/preferences', { method: 'PATCH', body: { mascotCosmetic: id } });
      toast(t('Pip’s look changed'), 'success');
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid gap-6">
      <section aria-labelledby="achievements" className="grid gap-3">
        <h2 id="achievements" className="font-display text-2xl font-bold">
          {t('Achievements')} <span className="tabular text-lg text-ink-500">({earned}/{motivation.badges.length})</span>
        </h2>
        <p className="text-sm text-ink-500">{t('Achievements are never taken away. Pain scores and stopping for safety never cost you anything.')}</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {motivation.badges.map((badge) => (
            <li key={badge.id} className={`card flex items-start gap-4 p-4 ${badge.earnedAt ? '' : 'bg-ink-50'}`}>
              <BadgeMedal badge={badge} size={56} />
              <div className="min-w-0">
                <p className={`font-extrabold ${badge.earnedAt ? 'text-ink-900' : 'text-ink-700'}`}>{badge.name}</p>
                <p className="text-sm text-ink-700">
                  <span className="font-bold">{t('How to earn it:')}</span> {badge.rule}
                </p>
                <p className="mt-1 text-xs font-bold text-ink-500">{badge.earnedAt ? t('Earned {date}', { date: formatDateTime(badge.earnedAt) }) : t('Not yet')}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pip-looks" className="card grid gap-4 p-5">
        <div>
          <h2 id="pip-looks" className="font-display text-xl font-bold">
            {t('Pip’s looks')}
          </h2>
          <p className="text-sm text-ink-500">{t('Just for fun. New looks unlock with achievements; nothing can be bought or lost.')}</p>
        </div>
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {motivation.cosmetics.map((cosmetic) => {
            const equipped = motivation.equipped === cosmetic.id;
            return (
              <li key={cosmetic.id}>
                <button
                  type="button"
                  disabled={!cosmetic.unlocked || equipped || saving !== null}
                  aria-pressed={equipped}
                  onClick={() => void equip(cosmetic.id)}
                  className={`grid min-h-11 w-full justify-items-center gap-1 rounded-2xl border-2 p-3 text-center text-sm font-extrabold transition ${equipped ? 'border-brand-500 bg-brand-50' : cosmetic.unlocked ? 'border-ink-100 bg-white hover:border-brand-200' : 'border-dashed border-ink-200 bg-ink-50 text-ink-500'}`}
                >
                  <span className={cosmetic.unlocked ? '' : 'opacity-40 grayscale'}>
                    <Mascot cosmetic={cosmetic.id} mood="wave" size={72} />
                  </span>
                  <span>{cosmeticName(cosmetic.id)}</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-ink-500">
                    {equipped ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t('Wearing')}
                      </>
                    ) : cosmetic.unlocked ? (
                      t('Unlocked')
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" /> {t('Unlocks with “{name}”', { name: badgeName.get(cosmetic.unlockedBy ?? '') ?? '' })}
                      </>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="history-title" className="card grid gap-3 p-5">
        <h2 id="history-title" className="font-display text-xl font-bold">
          {t('Achievement history')}
        </h2>
        {motivation.history.length === 0 ? (
          <p className="text-ink-500">{t('Your achievements and weekly goals will be listed here with their dates.')}</p>
        ) : (
          <ol className="grid gap-2">
            {motivation.history.map((entry) => (
              <li key={`${entry.type}:${entry.id}`} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-100 pb-2">
                <span className="font-bold">
                  {entry.type === 'achievement' ? entry.name : t('Weekly goal reached: {done} of {goal} sessions (week of {date})', { done: entry.done, goal: entry.goal, date: formatShort(entry.weekStart) })}
                </span>
                <span className="text-sm text-ink-500">{formatDateTime(entry.at)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
