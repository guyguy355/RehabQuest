import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';

/** Accessible modal built on the native <dialog> element (focus trap + Escape for free). */
export function Dialog({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
      className={`w-[calc(100%-2rem)] ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-4xl border-2 border-ink-100 bg-white p-0 text-ink-900 backdrop:bg-ink-900/40`}
    >
      {open ? (
        <div className="grid max-h-[85vh] gap-4 overflow-y-auto p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="dialog-title" className="font-display text-2xl font-bold leading-tight">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-500 hover:bg-ink-100" aria-label="Close">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
