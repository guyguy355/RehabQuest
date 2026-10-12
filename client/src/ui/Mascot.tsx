type Mood = 'wave' | 'cheer' | 'calm' | 'care' | 'think';

/**
 * Pip — RehabQuest's original mascot: a round, bouncy teal friend wearing a
 * coral sweatband with a small first-aid plus. Purely decorative (aria-hidden)
 * unless a label is passed.
 */
export function Mascot({ mood = 'wave', size = 120, label, className = '' }: { mood?: Mood; size?: number; label?: string; className?: string }) {
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

      {/* sweatband */}
      <path d="M24 46 C40 36 80 36 96 46 L94 56 C78 47 42 47 26 56 Z" fill="#F26B3A" />
      <rect x="56.5" y="40.5" width="7" height="2.4" rx="1.2" fill="#fff" />
      <rect x="58.8" y="38.2" width="2.4" height="7" rx="1.2" fill="#fff" />

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

      {mood === 'calm' ? (
        <g fill="#5A6C6D" fontFamily="Nunito, sans-serif" fontWeight="800">
          <text x="96" y="30" fontSize="12">z</text>
          <text x="104" y="20" fontSize="9">z</text>
        </g>
      ) : null}
    </svg>
  );
}
