import { useId } from "react";
import { CASH_ACCOUNT_ID, type Account } from "../accounting/types";
import { CASH_SOURCE_LABEL } from "../utils/labels";
import { Field, inputCls } from "./Field";

/**
 * Source selector: every active Vodafone account + the "(Cash) فلوس" pseudo-source.
 * `allowCash=false` disables the cash option (سحب/إيداع must target a wallet).
 */
export function AccountSelect({
  accounts,
  value,
  onChange,
  error,
  allowCash,
  label = "المصدر / الحساب",
  placeholder = "اختر الحساب",
}: {
  accounts: readonly Account[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
  allowCash: boolean;
  label?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} required>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputCls} ${error ? "border-neg" : ""} appearance-none bg-left bg-no-repeat`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237a879b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundPosition: "left 12px center",
        }}
      >
        <option value="">{placeholder}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.phone}
            {a.label ? ` — ${a.label}` : ""}
          </option>
        ))}
        <option value={CASH_ACCOUNT_ID} disabled={!allowCash}>
          {CASH_SOURCE_LABEL}
        </option>
      </select>
    </Field>
  );
}
