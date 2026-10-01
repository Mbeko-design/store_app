import { useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { OPERATION_TYPES, type OperationType } from "../accounting/types";
import { grandTotal, totalsByType } from "../accounting/totals";
import { buttonCls } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { FilterBar, type HistoryFilter } from "../components/FilterBar";
import { Icon } from "../components/Icon";
import { OperationList } from "../components/OperationList";
import { OperationTable } from "../components/OperationTable";
import { Pagination } from "../components/Pagination";
import { LoadingBlock, SkeletonList } from "../components/Skeleton";
import { useAccounts, useIsMobile, useLedger } from "../hooks/useData";
import { localDayEndExclusiveIso, localDayStartIso } from "../utils/dates";
import { formatEgp } from "../utils/format";
import { TYPE_LABEL, TYPE_STYLE } from "../utils/labels";

const PAGE_SIZE = 10;

/**
 * Category history (screen 4) — same pattern for السحب / الإيداع / الفلوس:
 * big total card → filters (date range, account, type) → newest-first list/table + pagination.
 * Supports global context and per-account context (visible filter chip in FilterBar).
 */
export function CategoryHistoryPage() {
  const { category } = useParams<{ category: string }>();
  const [params] = useSearchParams();
  const ledger = useLedger();
  const accounts = useAccounts(true);
  const isMobile = useIsMobile();

  const defaultType: OperationType = OPERATION_TYPES.includes(category as OperationType) ? (category as OperationType) : "withdraw";
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<HistoryFilter>({
    from: "",
    to: "",
    accountId: params.get("account") ?? "",
    type: defaultType,
  });

  // A different route param (e.g. via link) should reset the page/panel.
  const accountLabels = useMemo(
    () => new Map<string, string>((accounts ?? []).map((a) => [a.id, `${a.phone}${a.label ? ` — ${a.label}` : ""}`])),
    [accounts],
  );

  if (category && !OPERATION_TYPES.includes(category as OperationType)) {
    return <Navigate to="/" replace />;
  }

  if (!ledger) {
    return (
      <div className="space-y-4">
        <LoadingBlock label="جارٍ تحميل السجل…" />
        <SkeletonList rows={6} />
      </div>
    );
  }

  const fromIso = filter.from ? localDayStartIso(filter.from) : null;
  const toIso = filter.to ? localDayEndExclusiveIso(filter.to) : null;

  const filtered = ledger.operations.filter((op) => {
    if (filter.type !== "all" && op.type !== filter.type) return false;
    if (filter.accountId && op.accountId !== filter.accountId) return false;
    const t = Date.parse(op.occurredAtIso);
    if (fromIso && t < Date.parse(fromIso)) return false;
    if (toIso && t >= Date.parse(toIso)) return false;
    return true;
  });

  const totals = totalsByType(filtered);
  const shownTotal = filter.type === "all" ? grandTotal(totals) : totals[filter.type];
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeLabel = filter.type === "all" ? "كل العمليات" : TYPE_LABEL[filter.type];
  const activeTone = filter.type === "all" ? "text-ink" : TYPE_STYLE[filter.type].text;
  const hasFilters = !!(filter.from || filter.to || filter.accountId || filter.type !== defaultType);

  const onChangeFilter = (f: HistoryFilter) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-extrabold">
            {filter.type === "all" ? "سجل العمليات" : `سجل ${TYPE_LABEL[filter.type]}`}
          </h2>
          {hasFilters && (
            <span className="rounded-full border border-line bg-card px-2.5 py-1 text-xs font-bold text-ink-2">
              {accounts?.find((a) => a.id === filter.accountId)?.phone ?? "فلاتر مفعّلة"}
            </span>
          )}
        </div>
        <Link to="/summary" className={buttonCls("secondary", "h-10")}>
          <Icon name="table" size={16} />
          ملخص الحسابات
        </Link>
      </div>

      {/* Big total card */}
      <section aria-label="الإجمالي" className="rounded-lg border border-line bg-card p-5 shadow-card">
        <p className="text-sm font-bold text-ink-2">
          إجمالي {activeLabel}
          {filter.accountId ? " (لهذا الحساب)" : " (كل الحسابات)"}
          {hasFilters ? " — مع الفلاتر المفعّلة" : ""}
        </p>
        <p className={`mt-1 text-3xl font-extrabold ${activeTone}`}>
          <span className="bidi">{formatEgp(shownTotal)}</span>
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center text-sm">
          <div>
            <p className="text-[11px] font-bold text-ink-3">سحب</p>
            <p className="font-extrabold text-neg">
              <span className="bidi">{formatEgp(totals.withdraw)}</span>
            </p>
          </div>
          <div className="border-s border-line">
            <p className="text-[11px] font-bold text-ink-3">إيداع</p>
            <p className="font-extrabold text-pos">
              <span className="bidi">{formatEgp(totals.deposit)}</span>
            </p>
          </div>
          <div className="border-s border-line">
            <p className="text-[11px] font-bold text-ink-3">فلوس</p>
            <p className="font-extrabold text-cash">
              <span className="bidi">{formatEgp(totals.cash)}</span>
            </p>
          </div>
        </div>
      </section>

      <FilterBar filter={filter} onChange={onChangeFilter} accounts={accounts ?? []} defaultType={defaultType} />

      {filtered.length === 0 ? (
        <EmptyState
          icon="list"
          title={hasFilters ? "لا توجد نتائج مطابقة" : "لا توجد عمليات بعد"}
          description={hasFilters ? "جرّب توسيع نطاق الفلاتر أو إعادة تعيينها." : "سجّل أول عملية لتظهر هنا."}
          action={
            hasFilters ? (
              <button type="button" className={buttonCls("secondary")} onClick={() => onChangeFilter({ from: "", to: "", accountId: "", type: defaultType })}>
                إعادة تعيين الفلاتر
              </button>
            ) : (
              <Link to={`/add?type=${defaultType}`} className={buttonCls("primary")}>
                إضافة عملية
              </Link>
            )
          }
        />
      ) : (
        <>
          {isMobile ? (
            <OperationList operations={pageItems} accountLabels={accountLabels} />
          ) : (
            <OperationTable operations={pageItems} accountLabels={accountLabels} />
          )}
          <Pagination page={safePage} pageCount={pageCount} total={filtered.length} onPage={setPage} />
        </>
      )}
    </div>
  );
}
