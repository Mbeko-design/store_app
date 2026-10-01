import { useId } from "react";
import { Field, inputCls } from "./Field";

/**
 * Date & time input. The value is a local-time `datetime-local` string;
 * conversion to UTC ISO happens in validation/service (stored UTC, shown local).
 */
export function DateTimeInput({
  value,
  onChange,
  error,
  label = "التاريخ والوقت",
  required = true,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  label?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} hint="بالتوقيت المحلي لجهازك" required={required}>
      <input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputCls} ${error ? "border-neg" : ""}`}
        dir="ltr"
      />
    </Field>
  );
}
