import type { PatientStatus } from '../../services/mockPhysioPatients';

type PatientStatusFilterProps = {
  filters: PatientStatus[];
  activeFilter: PatientStatus;
  onChange: (filter: PatientStatus) => void;
};

export function PatientStatusFilter({ filters, activeFilter, onChange }: PatientStatusFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const isActive = activeFilter === filter;

        return (
          <button
            key={filter}
            type="button"
            onClick={() => onChange(filter)}
            className={[
              'h-11 rounded-xl px-4 text-sm font-bold transition active:scale-95',
              isActive
                ? 'bg-secondary-container text-on-secondary-container'
                : 'bg-surface-container-lowest text-on-surface-variant shadow-ambient hover:bg-surface-container-high',
            ].join(' ')}
          >
            {filter}
          </button>
        );
      })}
    </div>
  );
}
