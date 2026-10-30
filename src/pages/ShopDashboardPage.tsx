import { Link } from "react-router";
import { Button, buttonCls } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { PaymentBadge, StockBadge } from "../components/ShopBadges";
import { SkeletonCard, SkeletonList, LoadingBlock } from "../components/Skeleton";
import { SummaryCard } from "../components/SummaryCard";
import { useLoading } from "../hooks/useData";
import { useShopView } from "../hooks/useShop";
import { formatEgp, formatDateTime, formatTime } from "../utils/format";

/** لوحة المتجر — stock value, sales snapshot, restock alerts, recent receipts. */
export function ShopDashboardPage() {
  const view = useShopView();
  const loading = useLoading(view);

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingBlock label="جارٍ تحميل لوحة المتجر…" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
        <SkeletonList rows={4} />
      </div>
    );
  }
  if (!view) return null;

  if (view.totals.products === 0) {
    return (
      <EmptyState
        icon="box"
        title="لا توجد منتجات مسجلة"
        description="سجّل أول منتج للهاتف بالباركود لتبدأ الفواتير ومتابعة المخزون."
        action={
          <Link to="/shop/products" className={buttonCls("primary")}>
            <Icon name="plus" size={16} />
            تسجيل منتج جديد
          </Link>
        }
      />
    );
  }

  const recent = view.receipts.slice(0, 5);
  const low = view.low.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/shop/pos" className={buttonCls("primary")}>
          <Icon name="barcode" size={16} />
          نقطة البيع
        </Link>
        <Link to="/shop/products" className={buttonCls("secondary")}>
          <Icon name="plus" size={16} />
          تسجيل منتج
        </Link>
        <Link to="/shop/sales" className={buttonCls("secondary")}>
          <Icon name="receipt" size={16} />
          المبيعات
        </Link>
      </div>

      {/* Totals */}
      <section aria-label="إجماليات المتجر" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="مبيعات اليوم"
          amount={formatEgp(view.totals.salesToday)}
          tone="pos"
          icon="receipt"
          sub={`${view.totals.receiptsToday} فاتورة`}
        />
        <SummaryCard
          label="إجمالي المبيعات"
          amount={formatEgp(view.totals.salesAll)}
          tone="cash"
          icon="chart"
          sub={`${view.totals.receipts} فاتورة · ${view.totals.pieces} قطعة مباعة`}
        />
        <SummaryCard
          label="قيمة المخزون"
          amount={formatEgp(view.totals.stockValue)}
          tone="navy"
          icon="box"
          sub="بسعر البيع"
        />
        <SummaryCard
          label="القطع المتوفرة"
          amount={`${view.totals.pieces}`}
          tone="navy"
          icon="barcode"
          sub={`${view.totals.products} منتج مسجل`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Restock alerts */}
        <section aria-labelledby="low-stock">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="low-stock" className="text-lg font-extrabold">
              تنبيهات المخزون
            </h2>
            <Link to="/shop/inventory" className="text-sm font-bold text-cash underline underline-offset-4">
              فتح المخزون
            </Link>
          </div>
          {low.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg border border-pos-line bg-pos-bg p-4 text-sm font-bold text-pos">
              <Icon name="checkCircle" size={18} />
              كل المنتجات بمخزون كافٍ.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-card">
              {low.map((row) => (
                <li key={row.product.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{row.product.name}</p>
                    <p dir="ltr" className="mt-0.5 text-start font-mono text-xs text-ink-3">
                      {row.product.barcode}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="bidi text-sm font-extrabold text-ink-2">{row.stock} قطعة</span>
                    <StockBadge status={row.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent receipts */}
        <section aria-labelledby="recent-receipts">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="recent-receipts" className="text-lg font-extrabold">
              آخر الفواتير
            </h2>
            <Link to="/shop/sales" className="text-sm font-bold text-cash underline underline-offset-4">
              كل المبيعات
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState icon="receipt" title="لا توجد فواتير بعد" description="امسح منتجاتك من نقطة البيع لإنشاء أول فاتورة." />
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-card">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-navy/8 text-navy">
                      <Icon name="receipt" size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold">
                        فاتورة <span className="bidi">#{r.number}</span> ·{" "}
                        <span className="bidi font-mono text-xs text-ink-3">{formatTime(r.createdAtIso)}</span>
                      </p>
                      <p className="text-xs text-ink-3">{formatDateTime(r.createdAtIso)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <PaymentBadge method={r.paymentMethod} />
                    <span className="bidi text-sm font-extrabold text-pos">{formatEgp(r.totalPiastres)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Section note — shop data never touches the money ledger. */}
      <p className="text-xs text-ink-3">
        بيانات المتجر (المنتجات والفواتير والمخزون) مستقلة تمامًا عن حسابات وعمليات فيودافون كاش.
      </p>
    </div>
  );
}
