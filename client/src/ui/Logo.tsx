export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
        <rect x="1" y="3" width="38" height="36" rx="12" fill="#076B5F" />
        <rect x="1" y="1" width="38" height="35" rx="12" fill="#0A8274" />
        {/* a path of three stepping stones rising to a plus */}
        <circle cx="11" cy="27" r="3.4" fill="#96E8D6" />
        <circle cx="19" cy="21" r="3.4" fill="#C9F4EA" />
        <rect x="24.5" y="9" width="11" height="3.6" rx="1.8" fill="#FFC81A" />
        <rect x="28.2" y="5.3" width="3.6" height="11" rx="1.8" fill="#FFC81A" />
      </svg>
      {compact ? null : <span className="font-display text-2xl font-extrabold leading-none tracking-tight text-brand-700">RehabQuest</span>}
    </span>
  );
}
