import { useMemo, useState } from "react";
import { Button, buttonCls } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { SkeletonList, LoadingBlock } from "../components/Skeleton";
import { StockBadge } from "../components/ShopBadges";
import { StockDialog } from "../components/StockDialog";
import { SummaryCard } from "../components/SummaryCard";
import { useLoading } from "../hooks/useData";
import { useShopView } from "../hooks/useShop";
import type { Product } from "../shop/types";
import { formatEgp } from "../utils/format";
import { Link } from "react-router";

type Filter = "all" | "low" | "out";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "الكل" },
  { id: "low", label: "منخفض" },
  { id: "out", label: "نفد" },
];

/** المخزون — per-product stock, restock (إدخال) and physical count (جرد). */
export function InventoryPage() {
  const view = useShopView();
  const loading = useLoading(view);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<{ product: Product; mode: "in" | "count" } | undefined>();

  const rows = useMemo(() => {
    if (!view) return [];
    const q = query.trim().toLowerCase();
    return view.rows.filter((r) => {
      if (filter === "low" && r.status !== "low") return false;
      if (filter === "out" && r.status !== "out") return false;
      if (q && !r.product.name.toLowerCase().includes(q) && !r.product.barcode.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [view, filter, query]);

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingBlock label="جارٍ تحميل المخزون…" />
        <SkeletonList rows={6} />
      </div>
    );
  }
  if (!view) return null;

  if (view.totals.products === 0) {
    return (
      <EmptyState
        icon="box"
        title="المخزون فارغ"
        description="لا توجد منتجات مسجلة بعد — ابدأ بتسجيل منتج بالباركود."
        action={
          <Link to="/shop/products" className={buttonCls("primary")}>
            <Icon name="plus" size={16} />
            تسجيل منتج جديد
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <section aria-label="إجماليات المخزون" className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="إجمالي القطع" amount={`${view.totals.pieces}`} tone="navy" icon="box" sub={`${view.totals.products} منتج`} />
        <SummaryCard label="قيمة المخزون" amount={formatEgp(view.totals.stockValue)} tone="cash" icon="wallet" sub="بسعر البيع" />
        <SummaryCard
          label="تحتاج تزويد"
          amount={`${view.low.length}`}
          tone={view.low.length > 0 ? "neg" : "pos"}
          icon="alert"
          sub={view.low.length > 0 ? "نفد أو منخفض" : "كل المنتجات متوفرة"}
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="تصفية المخزون" className="flex rounded-md border border-line bg-card p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`h-9 rounded-md px-4 text-sm font-bold transition-colors ${
                filter === f.id ? "bg-navy text-white" : "text-ink-2 hover:bg-page"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-52 flex-1">
          <Icon name="filter" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            id="inv-search"
            type="search"
            value={query}
            placeholder="ابحث بالاسم أو الباركود…"
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-md border border-line bg-card ps-9 pe-3 text-base"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="filter" title="لا توجد نتائج" description="غيّر التصفية أو كلمة البحث." />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-card" aria-label="أرصدة المنتجات">
          {rows.map(({ product, stock, status }) => (
            <li key={product.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-44 flex-1">
                <p className="font-bold">{product.name}</p>
                <p dir="ltr" className="mt-0.5 text-start font-mono text-xs text-ink-3">
                  {product.barcode}
                </p>
              </div>

              <div className="text-end">
                <p className="bidi text-lg font-extrabold">{stock} قطعة</p>
                <p className="bidi text-xs text-ink-3">{formatEgp(product.pricePiastres)} للقطعة</p>
              </div>

              <StockBadge status={status} />

              <div className="flex gap-2">
                <Button type="button" variant="quiet" className="h-9 px-3" onClick={() => setTarget({ product, mode: "in" })}>
                  <Icon name="plus" size={14} />
                  إدخال
                </Button>
                <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => setTarget({ product, mode: "count" })}>
                  <Icon name="list" size={14} />
                  جرد
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <StockDialog
        open={Boolean(target)}
        mode={target?.mode ?? "in"}
        product={target?.product}
        stock={view.rows.find((r) => r.product.id === target?.product.id)?.stock ?? 0}
        onClose={() => setTarget(undefined)}
      />
    </div>
  );
}
