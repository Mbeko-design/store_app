import { Fragment, useState } from "react";
import { Link } from "react-router";
import type { Operation, OperationType } from "../accounting/types";
import { buttonCls } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { Pagination } from "../components/Pagination";
import { LoadingBlock, SkeletonList } from "../components/Skeleton";
import { SummaryCard } from "../components/SummaryCard";
import { useIsMobile, useLedger, type AccountView } from "../hooks/useData";
import { formatEgp, formatDateTime } from "../utils/format";
import { TYPE_LABEL, TYPE_STYLE } from "../utils/labels";

const PAGE_SIZE = 10;

/** Extra detail revealed by expanding a summary row (opening balance + last ops). */
function ExpandedDetail({ view, accountOps }: { view: AccountView; accountOps: readonly Operation[] }) {
  const last = accountOps.slice(0, 3);
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-3">
      <div className="rounded-md bg-card p-3">
        <p className="text-xs font-bold text-ink-3">الرصيد الافتتاحي (قابل للتعديل)</p>
        <p className="mt-0.5 font-extrabold">
          <span className="bidi">{formatEgp(view.account.openingBalancePiastres)}</span>
        </p>
        <p className="mt-1 text-[11px] text-ink-3">
          أُنشئ: <span className="bidi">{formatDateTime(view.account.createdAtIso)}</span>
        </p>
      </div>
      <div className="rounded-md bg-card p-3">
        <p className="text-xs font-bold text-ink-3">ليميت الشهر — المستخدم</p>
        <p className="mt-0.5 font-extrabold">
          <span className="bidi">
            {formatEgp(view.limit.usedPiastres)} / {formatEgp(view.limit.limitPiastres)}
          </span>
        </p>
        <Link to={`/accounts/${view.account.id}`} className="mt-1 inline-block text-xs font-bold text-cash underline underline-offset-2">
          فتح صفحة الحساب
        </Link>
      </div>
      <div className="rounded-md bg-card p-3">
        <p className="text-xs font-bold text-ink-3">آخر العمليات</p>
        {last.length === 0 ? (
          <p className="mt-1 text-xs text-ink-3">لا توجد عمليات.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {last.map((op) => (
              <li key={op.id} className="flex items-center justify-between gap-2 text-xs">
                <span className={`font-bold ${TYPE_STYLE[op.type as OperationType].text}`}>{TYPE_LABEL[op.type]}</span>
                <span className="text-ink-3">
                  <span className="bidi">{formatDateTime(op.occurredAtIso)}</span>
                </span>
                <span className={`font-extrabold ${TYPE_STYLE[op.type].text}`}>
                  <span className="bidi">{formatEgp(op.amountPiastres)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Accounts summary table (screen 6): three total cards + detailed table with
 * expandable rows and pagination. Mobile renders the same data as a list.
 */
export function AccountsSummaryPage() {
  const ledger = useLedger();
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!ledger) {
    return (
      <div className="space-y-4">
        <LoadingBlock label="جارٍ تحميل الملخص…" />
        <SkeletonList rows={6} />
      </div>
    );
  }

  const { totals, views, operations } = ledger;
  const pageCount = Math.max(1, Math.ceil(views.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = views.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (views.length === 0) {
    return (
      <EmptyState
        icon="table"
        title="لا توجد حسابات لعرض الملخص"
        description="أضف حسابًا أولًا ليظهر هنا تفصيل أرصدته وحدوده."
        action={
          <Link to="/accounts" className={buttonCls("primary")}>
            إضافة حساب
          </Link>
        }
      />
    );
  }

  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  return (
    <div className="space-y-5">
      <section aria-label="الإجماليات العامة" className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="إجمالي الإيداعات" amount={formatEgp(totals.deposit)} tone="pos" icon="arrowUp" />
        <SummaryCard label="إجمالي الفلوس" amount={formatEgp(totals.cash)} tone="cash" icon="wallet" />
        <SummaryCard label="إجمالي المسحوبات" amount={formatEgp(totals.withdraw)} tone="neg" icon="arrowDown" />
      </section>

      <p className="text-xs text-ink-3">
        ملخص الحسابات — أرقام على مستوى كل حساب، بينما البطاقات أعلاه إجماليات عامة. اضغط أي صف لعرض التفاصيل.
      </p>

      {isMobile ? (
        /* Mobile: stacked list with expandable details */
        <ul className="space-y-3">
          {rows.map((v) => {
            const open = expandedId === v.account.id;
            return (
              <li key={v.account.id} className="rounded-lg border border-line bg-card">
                <button
                  type="button"
                  onClick={() => toggle(v.account.id)}
                  aria-expanded={open}
                  className="flex min-h-14 w-full items-center gap-3 px-4 text-start"
                >
                  <Icon name={open ? "chevronDown" : "chevronLeft"} size={16} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-extrabold" dir="ltr">
                      {v.account.phone}
                    </span>
                    <span className="block truncate text-xs text-ink-3">{v.account.label || "بدون اسم"}</span>
                  </span>
                  <span className={`text-sm font-extrabold ${v.balancePiastres < 0 ? "text-neg" : "text-ink"}`}>
                    <span className="bidi">{formatEgp(v.balancePiastres)}</span>
                  </span>
                </button>
                {open && (
                  <div className="border-t border-line p-3">
                    <ExpandedDetail view={v} accountOps={operations.filter((o) => o.accountId === v.account.id)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        /* Desktop: semantic table with expandable rows */
        <div className="overflow-hidden rounded-lg border border-line bg-card">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">ملخص الحسابات: الرصيد والليميت والإجماليات لكل حساب</caption>
            <thead>
              <tr className="border-b border-line bg-page text-xs font-extrabold text-ink-2">
                <th scope="col" className="px-4 py-3 text-start">
                  الحساب
                </th>
                <th scope="col" className="px-4 py-3 text-start">
                  الرصيد الحالي
                </th>
                <th scope="col" className="px-4 py-3 text-start">
                  المتبقي من الليميت
                </th>
                <th scope="col" className="px-4 py-3 text-start">
                  إجمالي الإيداعات
                </th>
                <th scope="col" className="px-4 py-3 text-start">
                  إجمالي المسحوبات
                </th>
                <th scope="col" className="px-4 py-3 text-start">
                  إجمالي الفلوس
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((v) => {
                const open = expandedId === v.account.id;
                return (
                  <Fragment key={v.account.id}>
                    <tr className={open ? "bg-page/60" : "hover:bg-page/50"}>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggle(v.account.id)}
                          aria-expanded={open}
                          className="flex min-h-11 items-center gap-2 text-start font-extrabold"
                        >
                          <Icon name={open ? "chevronDown" : "chevronLeft"} size={16} />
                          <span dir="ltr">{v.account.phone}</span>
                        </button>
                        <span className="ms-7 block text-xs font-normal text-ink-3">{v.account.label || "بدون اسم"}</span>
                      </td>
                      <td className={`px-4 py-3 font-extrabold ${v.balancePiastres < 0 ? "text-neg" : "text-ink"}`}>
                        <span className="bidi">{formatEgp(v.balancePiastres)}</span>
                      </td>
                      <td className={`px-4 py-3 font-bold ${v.limit.exceeds ? "text-neg" : "text-ink-2"}`}>
                        <span className="bidi">{formatEgp(v.limit.remainingPiastres)}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-pos">
                        <span className="bidi">{formatEgp(v.totals.deposit)}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-neg">
                        <span className="bidi">{formatEgp(v.totals.withdraw)}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-cash">
                        <span className="bidi">{formatEgp(v.totals.cash)}</span>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-page/40">
                        <td colSpan={6} className="px-4 py-4">
                          <ExpandedDetail view={v} accountOps={operations.filter((o) => o.accountId === v.account.id)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={safePage} pageCount={pageCount} total={views.length} onPage={setPage} />
    </div>
  );
}
