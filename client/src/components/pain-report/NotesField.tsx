type NotesFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function NotesField({ value, onChange }: NotesFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-on-surface">Optional notes</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        placeholder="Add anything your physiotherapist should know..."
        className="mt-3 w-full resize-none rounded-2xl border border-outline-variant/50 bg-surface-container-lowest px-4 py-3 text-on-surface shadow-ambient outline-none transition placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}
