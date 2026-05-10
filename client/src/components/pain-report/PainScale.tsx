type PainScaleProps = {
  selectedPain: number | null;
  onSelect: (pain: number) => void;
};

export function PainScale({ selectedPain, onSelect }: PainScaleProps) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
        {Array.from({ length: 10 }, (_, index) => {
          const value = index + 1;
          const isSelected = selectedPain === value;

          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              className={[
                'grid h-14 place-items-center rounded-2xl border font-display text-lg font-semibold transition active:scale-95',
                isSelected
                  ? 'border-primary bg-primary text-on-primary shadow-ambient-lg'
                  : 'border-outline-variant/50 bg-surface-container-lowest text-on-surface hover:border-primary hover:bg-surface-container-low',
              ].join(' ')}
              aria-pressed={isSelected}
            >
              {value}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between text-xs font-semibold text-on-surface-variant">
        <span>Low pain</span>
        <span>Severe pain</span>
      </div>
    </div>
  );
}
