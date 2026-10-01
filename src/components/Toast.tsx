import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Toasts — accessible by spec: an aria-live region announces success/error.
 */
type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Live regions: polite for success, assertive for errors */}
      <div className="fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
        <div aria-live="polite" aria-atomic="false" className="contents">
          {items
            .filter((t) => t.tone !== "error")
            .map((t) => (
              <ToastCard key={t.id} item={t} />
            ))}
        </div>
        <div aria-live="assertive" aria-atomic="false" className="contents">
          {items
            .filter((t) => t.tone === "error")
            .map((t) => (
              <ToastCard key={t.id} item={t} />
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const tone =
    item.tone === "success"
      ? "bg-pos-bg text-pos border-pos-line"
      : item.tone === "error"
        ? "bg-neg-bg text-neg border-neg-line"
        : "bg-cash-bg text-cash border-cash-line";
  const icon = item.tone === "success" ? "checkCircle" : item.tone === "error" ? "alert" : "info";
  return (
    <div className={`pointer-events-auto flex items-center gap-2 rounded-md border px-4 py-3 shadow-pop text-sm font-semibold ${tone}`} role="status">
      <Icon name={icon} size={18} />
      <span className="text-ink">{item.message}</span>
    </div>
  );
}
