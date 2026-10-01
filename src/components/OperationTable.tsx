import type { Operation } from "../accounting/types";
import { formatDateTime, formatSignedEgp } from "../utils/format";
import { CASH_SOURCE_LABEL, TYPE_LABEL, TYPE_STYLE } from "../utils/labels";

/**
 * Semantic table for category history — DESKTOP only.
 * On mobile the same data is rendered as OperationList (spec: tables → lists).
 */
export function OperationTable({
  operations,
  accountLabels,
}: {
  operations: readonly Operation[];
  accountLabels?: Map<string, string>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-card">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">سجل العمليات مرتب من الأحدث إلى الأقدم</caption>
        <thead>
          <tr className="border-b border-line bg-page text-start text-xs font-extrabold text-ink-2">
            <th scope="col" className="px-4 py-3 text-start">
              النوع
            </th>
            <th scope="col" className="px-4 py-3 text-start">
              الحساب
            </th>
            <th scope="col" className="px-4 py-3 text-start">
              الملاحظة
            </th>
            <th scope="col" className="px-4 py-3 text-start">
              التاريخ والوقت
            </th>
            <th scope="col" className="px-4 py-3 text-end">
              المبلغ
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {operations.map((op) => {
            const style = TYPE_STYLE[op.type];
            const source = op.accountId === "cash" ? CASH_SOURCE_LABEL : accountLabels?.get(op.accountId) ?? "—";
            return (
              <tr key={op.id} className="hover:bg-page/60">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 font-bold">
                    <span className={`size-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
                    <span className={style.text}>{TYPE_LABEL[op.type]}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-2">{source}</td>
                <td className="max-w-40 truncate px-4 py-3 text-ink-2">{op.note || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">
                  <span className="bidi">{formatDateTime(op.occurredAtIso)}</span>
                </td>
                <td className={`whitespace-nowrap px-4 py-3 text-end font-extrabold ${style.text}`}>
                  <span className="bidi">{formatSignedEgp(op.type, op.amountPiastres)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
