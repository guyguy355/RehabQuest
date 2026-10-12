import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId } from 'react';

type Common = { label: string; hint?: ReactNode; error?: string };

function Wrapper({ id, label, hint, error, children }: Common & { id: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, { hint, error }: Common) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function TextField({ label, hint, error, id, className = '', ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Wrapper id={fieldId} label={label} hint={hint} error={error}>
      <input id={fieldId} className={`field-input ${className}`} aria-invalid={error ? true : undefined} aria-describedby={describedBy(fieldId, { label, hint, error })} {...props} />
    </Wrapper>
  );
}

export function TextArea({ label, hint, error, id, className = '', ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Wrapper id={fieldId} label={label} hint={hint} error={error}>
      <textarea id={fieldId} className={`field-input min-h-24 resize-y ${className}`} aria-invalid={error ? true : undefined} aria-describedby={describedBy(fieldId, { label, hint, error })} {...props} />
    </Wrapper>
  );
}

export function SelectField({ label, hint, error, id, className = '', children, ...props }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Wrapper id={fieldId} label={label} hint={hint} error={error}>
      <select id={fieldId} className={`field-input ${className}`} aria-invalid={error ? true : undefined} aria-describedby={describedBy(fieldId, { label, hint, error })} {...props}>
        {children}
      </select>
    </Wrapper>
  );
}
