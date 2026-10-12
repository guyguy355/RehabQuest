import { Search } from 'lucide-react';

type PatientSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function PatientSearchBar({ value, onChange }: PatientSearchBarProps) {
  return (
    <label className="relative block">
      <span className="sr-only">Search patients</span>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search patients..."
        className="h-12 w-full rounded-xl border border-outline-variant/50 bg-surface-container-lowest pl-12 pr-4 text-on-surface shadow-ambient outline-none transition placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}
