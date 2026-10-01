import { useId } from "react";
import { OPERATION_TYPES, type OperationType } from "../accounting/types";
import { inputCls } from "./Field";
import { Icon } from "./Icon";
import { TYPE_LABEL } from "../utils/labels";

export interface HistoryFilter {
  from: string; // "YYYY-MM-DD" local
  to: string;
  accountId: string; // "" = all
  type: OperationType | "all";
}

/**
 * Filter bar for category history: date range + account + type.
 * All controls are functional and wired to the page state.
 */
export function FilterBar({
  filter,
  onChange,
  accounts,
  defaultType,
}: {
  filter: HistoryFilter;
  onChange: (f: HistoryFilter) => void;
  accounts: ReadonlyArray<{ id: string; phone: string; label?: string }>;
  defaultType: OperationType;
}) {
  const fromId = useId();
  const toId = useId();
  const accId = useId();
  const typeId = useId();

  const set = (patch: Partial<HistoryFilter>) => onChange({ ...filter, ...patch });

  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-2">
        <Icon name="filter" size={16} />
        تصفية
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor={fromId} className="mb-1.5 block text-xs font-bold text-ink-2">
            من تاريخ
          </label>
          <input id={fromId} type="date" value={filter.from} onChange={(e) => set({ from: e.target.value })} className={inputCls} dir="ltr" />
        </div>
        <div>
          <label htmlFor={toId} className="mb-1.5 block text-xs font-bold text-ink-2">
            إلى تاريخ
          </label>
          <input id={toId} type="date" value={filter.to} onChange={(e) => set({ to: e.target.value })} className={inputCls} dir="ltr" />
        </div>
        <div>
          <label htmlFor={accId} className="mb-1.5 block text-xs font-bold text-ink-2">
            الحساب
          </label>
          <select id={accId} value={filter.accountId} onChange={(e) => set({ accountId: e.target.value })} className={inputCls}>
            <option value="">كل الحسابات</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.phone}
                {a.label ? ` — ${a.label}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={typeId} className="mb-1.5 block text-xs font-bold text-ink-2">
            النوع
          </label>
          <select
            id={typeId}
            value={filter.type}
            onChange={(e) => set({ type: e.target.value as OperationType | "all" })}
            className={inputCls}
          >
            <option value="all">الكل</option>
            {OPERATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
                {t === defaultType ? " (الحالي)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {filter.accountId && (
          <button
            type="button"
            onClick={() => set({ accountId: "" })}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-navy/20 bg-navy/8 px-3 text-xs font-bold text-navy"
          >
            حساب محدد: {accounts.find((a) => a.id === filter.accountId)?.phone ?? ""}
            <Icon name="close" size={14} />
            <span className="sr-only">إزالة تصفية الحساب</span>
          </button>
        )}
        {(filter.from || filter.to) && (
          <button
            type="button"
            onClick={() => set({ from: "", to: "" })}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-page px-3 text-xs font-bold text-ink-2"
          >
            نطاق زمني مفعّل
            <Icon name="close" size={14} />
            <span className="sr-only">إزالة التصفية الزمنية</span>
          </button>
        )}
        {(filter.type !== defaultType || filter.accountId || filter.from || filter.to) && (
          <button
            type="button"
            onClick={() => onChange({ from: "", to: "", accountId: "", type: defaultType })}
            className="h-9 rounded-md px-2 text-xs font-bold text-cash underline underline-offset-2"
          >
            إعادة تعيين
          </button>
        )}
      </div>
    </div>
  );
}
