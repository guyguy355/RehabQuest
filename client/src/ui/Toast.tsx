import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';

type Tone = 'success' | 'error' | 'info';
type Toast = { id: number; tone: Tone; message: string };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);

/** Short confirmations ("Saved") announced politely to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, tone: Tone = 'success') => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, tone, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? XCircle : Info;
          const style = toast.tone === 'success' ? 'bg-ink-900 text-white' : toast.tone === 'error' ? 'bg-rose-600 text-white' : 'bg-sky-700 text-white';
          return (
            <div key={toast.id} className={`pointer-events-auto flex max-w-md animate-rise items-center gap-2 rounded-2xl px-4 py-3 font-bold shadow-lg ${style}`}>
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {toast.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
