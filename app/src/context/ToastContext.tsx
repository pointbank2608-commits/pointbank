import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type ToastKind = 'info' | 'error';
interface ToastState {
  message: string;
  kind: ToastKind;
}

interface ToastValue {
  notify: (message: string, kind?: ToastKind) => void;
  /** 실패하면 에러 토스트를 띄우고 false 를 돌려준다. */
  run: (fn: () => Promise<void>, successMessage?: string) => Promise<boolean>;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, kind: ToastKind = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, kind });
    timer.current = setTimeout(() => setToast(null), kind === 'error' ? 4200 : 2200);
  }, []);

  const run = useCallback(
    async (fn: () => Promise<void>, successMessage?: string) => {
      try {
        await fn();
        if (successMessage) notify(successMessage);
        return true;
      } catch (err) {
        notify(err instanceof Error ? err.message : String(err), 'error');
        return false;
      }
    },
    [notify],
  );

  return (
    <ToastContext.Provider value={{ notify, run }}>
      {children}
      {toast && (
        <div
          className={`fixed left-1/2 bottom-6 -translate-x-1/2 max-w-[90vw] px-5 py-2.5 rounded-full font-label-md text-label-md text-white shadow-lg z-50 ${
            toast.kind === 'error' ? 'bg-error' : 'bg-deep-navy'
          }`}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast 는 ToastProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
