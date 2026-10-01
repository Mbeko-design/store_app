import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";

/**
 * Confirmation dialog — used for archive / destructive actions (spec).
 * Esc cancels, focus starts on the safe (cancel) action, modal semantics for AT.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy/45" onClick={() => !loading && onClose()} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="relative w-full max-w-sm rounded-lg border border-line bg-card p-5 shadow-pop">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-md ${danger ? "bg-neg-bg text-neg" : "bg-navy/10 text-navy"}`}>
            <Icon name={danger ? "alert" : "info"} size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-lg font-bold">
              {title}
            </h2>
            <div className="mt-1 text-sm text-ink-2 leading-relaxed">{message}</div>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <Button ref={cancelRef} variant="secondary" className="flex-1" onClick={onClose} disabled={loading} type="button">
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} className="flex-1" onClick={onConfirm} loading={loading} type="button">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
