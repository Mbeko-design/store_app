import type { Operation } from "../accounting/types";
import { formatDateTime, formatSignedEgp } from "../utils/format";
import { CASH_SOURCE_LABEL, TYPE_LABEL, TYPE_STYLE } from "../utils/labels";

/** Single operation row (list variant): type dot + labels + amount + local time. */
export function OperationRow({ op, accountLabel, showAccount = true }: { op: Operation; accountLabel?: string; showAccount?: boolean }) {
  const style = TYPE_STYLE[op.type];
  const source = op.accountId === "cash" ? CASH_SOURCE_LABEL : accountLabel ?? "";
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className={`size-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className={`text-sm font-extrabold ${style.text}`}>{TYPE_LABEL[op.type]}</span>
          {showAccount && source && <span className="truncate text-sm text-ink-2">{source}</span>}
        </div>
        <p className="truncate text-xs text-ink-3">
          <span className="bidi">{formatDateTime(op.occurredAtIso)}</span>
          {op.note ? ` · ${op.note}` : ""}
        </p>
      </div>
      <span className={`shrink-0 text-sm font-extrabold ${style.text}`} dir="rtl">
        <span className="bidi">{formatSignedEgp(op.type, op.amountPiastres)}</span>
      </span>
    </li>
  );
}

/** Plain list of operations (dashboard recent list / mobile). */
export function OperationList({
  operations,
  accountLabels,
  showAccounts = true,
  bordered = true,
}: {
  operations: readonly Operation[];
  accountLabels?: Map<string, string>;
  showAccounts?: boolean;
  bordered?: boolean;
}) {
  return (
    <ul className={`divide-y ${bordered ? "divide-line rounded-lg border border-line bg-card" : ""}`}>
      {operations.map((op) => (
        <OperationRow key={op.id} op={op} accountLabel={accountLabels?.get(op.accountId)} showAccount={showAccounts} />
      ))}
    </ul>
  );
}
