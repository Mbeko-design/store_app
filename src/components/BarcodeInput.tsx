import { useEffect, useRef, type Ref } from "react";
import { Icon } from "./Icon";
import { Field, inputCls } from "./Field";

/**
 * Barcode input for the USB scanner (keyboard-wedge: the scanner types the
 * code then Enter). Enter → onScan(code); the parent clears the value and the
 * field keeps focus so the next product can be scanned immediately.
 * Controlled: the parent owns `value` (it is the record submitted).
 */
export interface BarcodeInputProps {
  id: string;
  value: string;
  onValueChange: (v: string) => void;
  /** Called with the scanned code on Enter (trimmed). */
  onScan: (code: string) => void;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  autoFocus?: boolean;
  /** Large POS-style field. */
  big?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** External focus handle (e.g., refocus after closing a dialog). */
  inputRef?: Ref<HTMLInputElement>;
}

export function BarcodeInput({
  id,
  value,
  onValueChange,
  onScan,
  label = "الباركود",
  hint = "امسح الباركود بالماسح ثم Enter",
  error,
  required,
  autoFocus,
  big,
  placeholder = "امسح الباركود…",
  disabled,
  inputRef,
}: BarcodeInputProps) {
  const innerRef = useRef<HTMLInputElement>(null);
  const setRefs = (node: HTMLInputElement | null) => {
    innerRef.current = node;
    if (typeof inputRef === "function") inputRef(node);
    else if (inputRef && "current" in inputRef) (inputRef as { current: HTMLInputElement | null }).current = node;
  };

  useEffect(() => {
    if (autoFocus) innerRef.current?.focus();
  }, [autoFocus]);

  const keyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = value.trim();
    if (!code || disabled) return;
    onScan(code);
    onValueChange("");
    // Stay ready for the next scan.
    requestAnimationFrame(() => innerRef.current?.focus());
  };

  const field = (
    <div className="relative">
      <Icon
        name="barcode"
        size={big ? 22 : 18}
        className={`pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 ${error ? "text-neg" : "text-ink-3"}`}
      />
      <input
        ref={setRefs}
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        dir="ltr"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={keyDown}
        aria-invalid={error ? true : undefined}
        className={`${inputCls} ${error ? "border-neg" : ""} ${
          big ? "h-14 ps-11 text-lg font-bold" : "ps-9"
        } font-mono tracking-wide`}
      />
    </div>
  );

  if (label === "") return field; // bare field (dialog use)
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required}>
      {field}
    </Field>
  );
}
