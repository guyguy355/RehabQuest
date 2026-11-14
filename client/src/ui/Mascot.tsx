type Mood = 'wave' | 'cheer' | 'calm' | 'care' | 'think';

/** Cosmetic looks unlocked by achievements (server: services/gamification.ts COSMETICS). */
export const COSMETIC_IDS = ['classic', 'sunband', 'scarf', 'cap', 'headphones', 'flower', 'glasses', 'medal'] as const;
export type Cosmetic = (typeof COSMETIC_IDS)[number];

/**
 * Pip — RehabQuest's original mascot: a round, bouncy teal friend wearing a
 * coral sweatband with a small first-aid plus. Purely decorative (aria-hidden)
 * unless a label is passed.
 */
export function Mascot({ mood = 'wave', size = 120, label, className = '', cosmetic = 'classic' }: { mood?: Mood; size?: number; label?: string; className?: string; cosmetic?: string }) {
  const eyesClosed = mood === 'calm';

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {/* shadow */}
      <ellipse cx="60" cy="110" rx="30" ry="5" fill="#152A2C" opacity="0.08" />

      {/* arms (behind body when down) */}
      {mood === 'calm' || mood === 'think' ? (
        <>
          <path d="M24 74 q-8 10 -4 20" stroke="#12A58B" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M96 74 q8 10 4 20" stroke="#12A58B" strokeWidth="8" strokeLinecap="round" fill="none" />
        </>
      ) : null}
      {mood === 'wave' ? (
        <>
          <path d="M24 74 q-8 10 -4 20" stroke="#12A58B" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M95 66 q14 -10 12 -28" stroke="#12A58B" strokeWidth="8" strokeLinecap="round" fill="none" />
        </>
      ) : null}
      {mood === 'cheer' ? (
        <>
          <path d="M25 64 q-14 -10 -12 -30" stroke="#12A58B" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M95 64 q14 -10 12 -30" stroke="#12A58B" strokeWidth="8" strokeLinecap="round" fill="none" />
        </>
      ) : null}

      {/* feet */}
      <ellipse cx="45" cy="104" rx="11" ry="6" fill="#0A8274" />
      <ellipse cx="75" cy="104" rx="11" ry="6" fill="#0A8274" />

      {/* body */}
      <path d="M60 24 C88 24 100 44 100 68 C100 92 84 104 60 104 C36 104 20 92 20 68 C20 44 32 24 60 24 Z" fill="#2BBFA4" />
      <path d="M22 76 C26 96 42 104 60 104 C78 104 94 96 98 76 C90 90 76 96 60 96 C44 96 30 90 22 76 Z" fill="#12A58B" opacity="0.55" />
      <ellipse cx="60" cy="80" rx="22" ry="15" fill="#C9F4EA" />

      {/* sweatband (covered by the cap) */}
      {cosmetic === 'cap' ? (
        <>
          <path d="M24 50 C24 30 40 20 60 20 C80 20 96 30 96 50 C80 42 40 42 24 50 Z" fill="#3B6FD8" />
          <path d="M60 44 C78 44 98 46 108 52 C98 55 78 52 60 50 Z" fill="#2A55B0" />
          <circle cx="60" cy="21" r="3" fill="#2A55B0" />
        </>
      ) : (
        <>
          <path d="M24 46 C40 36 80 36 96 46 L94 56 C78 47 42 47 26 56 Z" fill={cosmetic === 'sunband' ? '#F5B82E' : '#F26B3A'} />
          <rect x="56.5" y="40.5" width="7" height="2.4" rx="1.2" fill="#fff" />
          <rect x="58.8" y="38.2" width="2.4" height="7" rx="1.2" fill="#fff" />
        </>
      )}
      {cosmetic === 'headphones' ? (
        <>
          <path d="M18 62 C16 30 104 30 102 62" stroke="#4B3A8C" strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="11" y="56" width="12" height="20" rx="6" fill="#6E56CF" />
          <rect x="97" y="56" width="12" height="20" rx="6" fill="#6E56CF" />
        </>
      ) : null}
      {cosmetic === 'flower' ? (
        <g transform="translate(86 32)">
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse key={angle} cx="0" cy="-6" rx="4" ry="6" fill="#F589B5" transform={`rotate(${angle})`} />
          ))}
          <circle r="3.5" fill="#F5B82E" />
        </g>
      ) : null}

      {/* eyes */}
      {eyesClosed ? (
        <>
          <path d="M39 63 q7 6 14 0" stroke="#152A2C" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d="M67 63 q7 6 14 0" stroke="#152A2C" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="46" cy="63" r="8.5" fill="#fff" />
          <circle cx="74" cy="63" r="8.5" fill="#fff" />
          <circle cx={mood === 'think' ? 49 : 47} cy={mood === 'think' ? 60 : 62} r="4.4" fill="#152A2C" />
          <circle cx={mood === 'think' ? 77 : 75} cy={mood === 'think' ? 60 : 62} r="4.4" fill="#152A2C" />
          <circle cx="48.6" cy="60.4" r="1.4" fill="#fff" />
          <circle cx="76.6" cy="60.4" r="1.4" fill="#fff" />
        </>
      )}

      {cosmetic === 'glasses' ? (
        <g stroke="#152A2C" strokeWidth="2.6" fill="none">
          <circle cx="46" cy="63" r="11" />
          <circle cx="74" cy="63" r="11" />
          <path d="M57 62 h6" />
        </g>
      ) : null}

      {/* cheeks + mouth */}
      <ellipse cx="36" cy="73" rx="5" ry="3" fill="#FF8A5B" opacity="0.45" />
      <ellipse cx="84" cy="73" rx="5" ry="3" fill="#FF8A5B" opacity="0.45" />
      {mood === 'cheer' ? (
        <path d="M51 72 q9 11 18 0 z" fill="#152A2C" />
      ) : mood === 'think' ? (
        <path d="M54 75 h12" stroke="#152A2C" strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d="M52 73 q8 7 16 0" stroke="#152A2C" strokeWidth="3" strokeLinecap="round" fill="none" />
      )}

      {/* holding a heart (care) */}
      {mood === 'care' ? (
        <>
          <path d="M60 98 C48 90 44 84 48 79 C51 75 57 76 60 81 C63 76 69 75 72 79 C76 84 72 90 60 98 Z" fill="#E5484D" />
          <path d="M28 76 q10 4 20 6" stroke="#12A58B" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M92 76 q-10 4 -20 6" stroke="#12A58B" strokeWidth="8" strokeLinecap="round" fill="none" />
        </>
      ) : null}

      {cosmetic === 'scarf' ? (
        <>
          <path d="M26 84 C44 94 76 94 94 84 L95 92 C76 102 44 102 25 92 Z" fill="#8E4EC6" />
          <path d="M78 92 L84 108 L74 108 L71 94 Z" fill="#7A3FB0" />
        </>
      ) : null}
      {cosmetic === 'medal' ? (
        <>
          <path d="M52 78 L60 90 L68 78" stroke="#3B6FD8" strokeWidth="4" fill="none" />
          <circle cx="60" cy="93" r="7" fill="#F5B82E" stroke="#C98A00" strokeWidth="1.5" />
        </>
      ) : null}

      {mood === 'calm' ? (
        <g fill="#5A6C6D" fontFamily="Nunito, sans-serif" fontWeight="800">
          <text x="96" y="30" fontSize="12">z</text>
          <text x="104" y="20" fontSize="9">z</text>
        </g>
      ) : null}
    </svg>
  );
}
