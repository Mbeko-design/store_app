import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

interface ToastItem {
  id: number;
  message: string;
  tone: "ok" | "error";
  action?: ToastAction;
}

interface ToastContextValue {
  show: (message: string, opts?: { tone?: "ok" | "error"; action?: ToastAction; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastContextValue["show"]>(
    (message, opts) => {
      const id = nextId.current++;
      const item: ToastItem = { id, message, tone: opts?.tone ?? "ok", action: opts?.action };
      setItems((prev) => [...prev.slice(-2), item]);
      window.setTimeout(() => remove(id), opts?.duration ?? 5000);
    },
    [remove],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-2.5 text-sm shadow-lg ${
              t.tone === "error" ? "bg-red-600 text-white" : "bg-slate-900 text-white"
            }`}
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30"
                onClick={() => {
                  void t.action?.onClick();
                  remove(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="opacity-60 hover:opacity-100" aria-label="close" onClick={() => remove(t.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}
