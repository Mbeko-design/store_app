import type { OperationType } from "../accounting/types";
import { TYPE_LABEL } from "../utils/labels";

export type DetailTab = "summary" | OperationType;

const TABS: Array<{ id: DetailTab; label: string }> = [
  { id: "summary", label: "ملخص الحساب" },
  { id: "withdraw", label: TYPE_LABEL.withdraw },
  { id: "deposit", label: TYPE_LABEL.deposit },
  { id: "cash", label: TYPE_LABEL.cash },
];

/** Tabs on the account details page (ملخص الحساب، السحب، الإيداع، الفلوس). */
export function CategoryTabs({ value, onChange }: { value: DetailTab; onChange: (t: DetailTab) => void }) {
  return (
    <div role="tablist" aria-label="أقسام تفاصيل الحساب" className="flex overflow-x-auto border-b border-line">
      {TABS.map((tab) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`min-h-11 whitespace-nowrap border-b-2 px-4 text-sm font-bold transition-colors ${
              selected ? "border-navy text-navy" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
