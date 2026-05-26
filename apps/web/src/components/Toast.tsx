import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  title: string;
  message?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  push: (toast: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, { shell: string; dot: string }> = {
  success: { shell: 'border-emerald-200/80 bg-emerald-50/95 text-emerald-900', dot: 'bg-emerald-400' },
  error: { shell: 'border-rose-200/80 bg-rose-50/95 text-rose-900', dot: 'bg-rose-400' },
  info: { shell: 'border-violet-200/80 bg-violet-50/95 text-violet-900', dot: 'bg-violet-400' }
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { ...toast, id }].slice(-4));
    window.setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(() => ({
    push,
    success: (title, message) => push({ title, message, tone: 'success' }),
    error: (title, message) => push({ title, message, tone: 'error' }),
    info: (title, message) => push({ title, message, tone: 'info' })
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-md ${toneStyles[toast.tone].shell}`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${toneStyles[toast.tone].dot}`} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{toast.title}</div>
                  {toast.message ? <div className="mt-1 text-xs leading-5 opacity-80">{toast.message}</div> : null}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
