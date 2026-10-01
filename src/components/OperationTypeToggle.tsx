import { OPERATION_TYPES, type OperationType } from "../accounting/types";
import { Icon, type IconName } from "../components/Icon";
import { TYPE_LABEL } from "../utils/labels";

const TYPE_ICON: Record<OperationType, IconName> = {
  withdraw: "arrowDown",
  deposit: "arrowUp",
  cash: "wallet",
};

const TYPE_SEL: Record<OperationType, string> = {
  withdraw: "border-neg bg-neg-bg text-neg",
  deposit: "border-pos bg-pos-bg text-pos",
  cash: "border-cash bg-cash-bg text-cash",
};

/**
 * Operation type toggle (سحب / إيداع / فلوس) — radiogroup semantics,
 * selected state shown by icon + label + color (never color alone).
 */
export function OperationTypeToggle({
  value,
  onChange,
  error,
}: {
  value: OperationType | "";
  onChange: (v: OperationType) => void;
  error?: string;
}) {
  return (
    <div>
      <span className="mb-2 block text-sm font-bold text-ink-2" id="optype-label">
        نوع العملية
      </span>
      <div role="radiogroup" aria-labelledby="optype-label" aria-invalid={error ? true : undefined} className="grid grid-cols-3 gap-2">
        {OPERATION_TYPES.map((t) => {
          const selected = value === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(t)}
              className={`flex h-12 items-center justify-center gap-2 rounded-md border-2 text-sm font-bold transition-colors ${
                selected ? TYPE_SEL[t] : "border-line bg-card text-ink-2 hover:bg-page"
              }`}
            >
              <Icon name={TYPE_ICON[t]} size={18} />
              {TYPE_LABEL[t]}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-neg">
          {error}
        </p>
      )}
    </div>
  );
}
