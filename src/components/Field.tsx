import type { ReactNode } from "react";

/** Form field wrapper: label + error/hint with proper aria wiring. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-bold text-ink-2">
        {label}
        {required && (
          <span className="text-neg" aria-hidden="true">
            {" *"}
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-xs font-semibold text-neg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Shared text-input styles (44px height = touch target minimum). */
export const inputCls = "h-11 w-full rounded-md border border-line bg-card px-3 text-base text-ink placeholder:text-ink-3";
export const inputErrorCls = "border-neg";
