import { useMemo, useState } from "react";
import { Link } from "react-router";
import { buttonCls } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { PaymentBadge } from "../components/ShopBadges";
import { ReceiptPrintButton } from "../components/ReceiptPrintButton";
import { SkeletonList, LoadingBlock } from "../components/Skeleton";
import { SummaryCard } from "../components/SummaryCard";
import { useLoading } from "../hooks/useData";
import { useShopView } from "../hooks/useShop";
import {
  averageReceipt,
  receiptsInRange,
  salesProfit,
  salesTotal,
  soldItems,
  todayRange,
  type PaymentMethod,
  type Receipt,
} from "../shop";
import { localMonthRange } from "../utils/dates";
import { formatEgp, formatDateTime, formatTime } from "../utils/format";

type Period = "all" | "today" | "month" | "custom";
type MethodFilter = "all" | PaymentMethod;

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "today", label: "اليوم" },
  { id: "month", label: "هذا الشهر" },
  { id: "custom", label: "فترة محددة" },
  { id: "all", label: "الكل" },
];
const METHODS: Array<{ id: MethodFilter; label: string }> = [
  { id: "all", label: "كل الطرق" },
  { id: "cash", label: "نقدًا" },
  { id: "vodafone", label: "فودافون كاش" },
];

function dateInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** المبيعات — receipts (expandable), sold-items report, filters. */
export function SalesPage() {
  const view = useShopView();
  const loading = useLoading(view);
  const [period, setPeriod] = useState<Period>("today");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [fromDate, setFromDate] = useState(() => dateInputValue(new Date()));
  const [toDate, setToDate] = useState(() => dateInputValue(new Date()));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!view) return [] as Receipt[];
    let list = view.receipts;
    if (period === "today") {
      const { start, end } = todayRange();
      list = receiptsInRange(list, start, end);
    } else if (period === "month") {
      const { start, end } = localMonthRange();
      list = receiptsInRange(list, start, end);
    } else if (period === "custom") {
      if (fromDate && toDate && fromDate > toDate) return [] as Receipt[];
      const start = fromDate ? new Date(`${fromDate}T00:00:00`) : undefined;
      const end = toDate ? new Date(`${toDate}T00:00:00`) : undefined;
      if (end) end.setDate(end.getDate() + 1);
      list = list.filter((receipt) => {
        const time = Date.parse(receipt.createdAtIso);
        return (!start || time >= start.getTime()) && (!end || time < end.getTime());
      });
    }
    if (method !== "all") list = list.filter((r) => r.paymentMethod === method);
    return list;
  }, [view, period, method, fromDate, toDate]);

  const sold = useMemo(() => soldItems(filtered), [filtered]);
  const total = useMemo(() => salesTotal(filtered), [filtered]);
  const average = useMemo(() => averageReceipt(filtered), [filtered]);
  const profit = useMemo(() => salesProfit(filtered, view?.products ?? []), [filtered, view?.products]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingBlock label="جارٍ تحميل المبيعات…" />
        <SkeletonList rows={6} />
      </div>
    );
  }
  if (!view) return null;

  if (view.totals.receipts === 0) {
    return (
      <EmptyState
        icon="receipt"
        title="لا توجد فواتير بعد"
        description="سجّل أول فاتورة من نقطة البيع لتظهر هنا مع تقرير القطع المباعة."
        action={
          <Link to="/shop/pos" className={buttonCls("primary")}>
            <Icon name="barcode" size={16} />
            نقطة البيع
          </Link>
        }
      />
    );
  }

  const chipCls = (active: boolean) =>
    `h-9 rounded-md px-4 text-sm font-bold transition-colors ${active ? "bg-brand text-white" : "text-ink-2 hover:bg-page"}`;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="الفترة" className="flex rounded-md border border-line bg-card p-1">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)} className={chipCls(period === p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-card p-2 text-sm">
            <label htmlFor="sales-from" className="font-bold">من</label>
            <input id="sales-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 rounded border border-line px-2" dir="ltr" />
            <label htmlFor="sales-to" className="font-bold">إلى</label>
            <input id="sales-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 rounded border border-line px-2" dir="ltr" />
          </div>
        )}
        <div role="group" aria-label="طريقة الدفع" className="flex rounded-md border border-line bg-card p-1">
          {METHODS.map((m) => (
            <button key={m.id} type="button" aria-pressed={method === m.id} onClick={() => setMethod(m.id)} className={chipCls(method === m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Totals of the filtered set */}
      <section aria-label="إجماليات المبيعات" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="عدد الفواتير" amount={`${filtered.length}`} tone="brand" icon="receipt" />
        <SummaryCard label="إجمالي المبيعات" amount={formatEgp(total)} tone="pos" icon="chart" />
        <SummaryCard
          label="الربح الإجمالي التقديري"
          amount={formatEgp(profit.profitPiastres)}
          tone={profit.profitPiastres < 0 ? "neg" : "cash"}
          icon="wallet"
          sub={[
            profit.estimatedLegacyLineCount > 0 ? `تقدير بالتكلفة الحالية لـ ${profit.estimatedLegacyLineCount} بند قديم` : "",
            profit.uncostedLineCount > 0 ? `تكلفة غير مسجلة لـ ${profit.uncostedLineCount} بند` : "",
          ].filter(Boolean).join(" · ") || "بعد خصم تكلفة الجملة المسجلة وقت البيع"}
        />
        <SummaryCard label="متوسط الفاتورة" amount={formatEgp(average)} tone="cash" icon="table" />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Receipts */}
        <section aria-labelledby="receipts-h">
          <h2 id="receipts-h" className="mb-3 text-lg font-extrabold">
            الفواتير <span className="text-sm font-bold text-ink-3">({filtered.length})</span>
          </h2>
          {filtered.length === 0 ? (
            <EmptyState icon="filter" title="لا توجد فواتير في هذه التصفية" description="جرّب فترة أو طريقة دفع أخرى." />
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-card">
              {filtered.map((r) => {
                const open = expanded.has(r.id);
                return (
                  <li key={r.id}>
                    <div className="flex items-center gap-3 p-4">
                      <button
                        type="button"
                        onClick={() => toggle(r.id)}
                        aria-expanded={open}
                        aria-label={`تفاصيل الفاتورة رقم ${r.number}`}
                        className="grid size-9 shrink-0 place-items-center rounded-md border border-line text-ink-2 hover:bg-page"
                      >
                        <Icon name={open ? "chevronDown" : "chevronLeft"} size={16} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">
                          فاتورة <span className="bidi">#{r.number}</span>
                          <span className="ms-2 text-xs font-normal text-ink-3">
                            <span className="bidi font-mono">{formatTime(r.createdAtIso)}</span> ·{" "}
                            {formatDateTime(r.createdAtIso).split(",")[0]}
                          </span>
                        </p>
                        <p className="text-xs text-ink-3">
                          <span className="bidi">{r.lines.reduce((s, l) => s + l.qty, 0)}</span> قطعة ·{" "}
                          {r.lines.length} صنف
                        </p>
                      </div>
                      <PaymentBadge method={r.paymentMethod} />
                      <span className="bidi shrink-0 font-extrabold text-pos">{formatEgp(r.totalPiastres)}</span>
                    </div>

                    {open && (
                      <div className="border-t border-line bg-page px-4 py-3">
                        <table className="w-full text-sm">
                          <caption className="sr-only">أصناف الفاتورة رقم {r.number}</caption>
                          <thead>
                            <tr className="text-xs text-ink-3">
                              <th scope="col" className="pb-2 text-start font-bold">الصنف</th>
                              <th scope="col" className="pb-2 text-center font-bold">الكمية</th>
                              <th scope="col" className="pb-2 text-center font-bold">السعر</th>
                              <th scope="col" className="pb-2 text-end font-bold">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {r.lines.map((l) => (
                              <tr key={l.productId}>
                                <td className="py-2">
                                  <span className="font-bold">{l.name}</span>
                                  <span dir="ltr" className="ms-2 block font-mono text-[11px] text-ink-3">{l.barcode}</span>
                                </td>
                                <td className="bidi py-2 text-center font-bold">{l.qty}</td>
                                <td className="bidi py-2 text-center text-ink-2">{formatEgp(l.pricePiastres)}</td>
                                <td className="bidi py-2 text-end font-bold">{formatEgp(l.pricePiastres * l.qty)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {r.discountPiastres !== undefined && r.discountPiastres > 0 && (
                          <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                            <div className="flex justify-between gap-3">
                              <span>الإجمالي قبل الخصم</span>
                              <span className="bidi">{formatEgp(r.subtotalPiastres ?? r.totalPiastres + r.discountPiastres)}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span>كود الخصم: {r.discountCode} ({r.discountPercent}%)</span>
                            </div>
                            <div className="flex justify-between gap-3 text-ink-2">
                              <span>قيمة الخصم</span>
                              <span className="bidi">−{formatEgp(r.discountPiastres)}</span>
                            </div>
                            <div className="flex justify-between gap-3 font-extrabold">
                              <span>الإجمالي بعد الخصم</span>
                              <span className="bidi">{formatEgp(r.totalPiastres)}</span>
                            </div>
                          </div>
                        )}
                        <div className="mt-3 flex justify-end">
                          <ReceiptPrintButton receipt={r} />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Sold items report */}
        <section aria-labelledby="sold-h">
          <h2 id="sold-h" className="mb-3 text-lg font-extrabold">
            القطع المباعة <span className="text-sm font-bold text-ink-3">(مضبوطة على التصفية)</span>
          </h2>
          {sold.length === 0 ? (
            <EmptyState icon="box" title="لا توجد مبيعات في هذه التصفية" description="غيّر الفترة أو طريقة الدفع." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-line bg-card">
              <ul className="divide-y divide-line">
                {sold.map((item) => (
                  <li key={item.productId} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{item.name}</p>
                      <p dir="ltr" className="mt-0.5 text-start font-mono text-xs text-ink-3">{item.barcode}</p>
                    </div>
                    <div className="text-end">
                      <p className="bidi font-extrabold">{item.qty} قطعة</p>
                      <p className="bidi text-xs text-ink-3">{formatEgp(item.revenuePiastres)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-3 border-t-2 border-line bg-page px-4 py-3">
                <span className="font-extrabold">الإجمالي</span>
                <span className="bidi font-extrabold text-pos">
                  {sold.reduce((s, i) => s + i.qty, 0)} قطعة · {formatEgp(total)}
                </span>
              </div>
            </div>
          )}
        </section>
      </div>

      <p className="text-xs text-ink-3">
        الفواتير محفوظة برقم متسلسل وتُخصم كمياتها من المخزون تلقائيًا — لا يوجد حذف للفواتير (تصحيح عبر الجرد).
      </p>
    </div>
  );
}
