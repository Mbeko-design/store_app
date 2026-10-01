import { useId } from "react";
import { Field, inputCls } from "./Field";

/**
 * Amount input in EGP. Parsing/rounding to piastres happens in validation —
 * this component only collects the text and shows validation errors.
 */
export function AmountInput({
  value,
  onChange,
  error,
  hint,
  label = "المبلغ",
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  label?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${inputCls} ${error ? "border-neg" : ""} pl-16 text-start`}
        />
        <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm font-bold text-ink-3" aria-hidden="true">
          جنيه
        </span>
      </div>
    </Field>
  );
}
