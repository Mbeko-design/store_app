import { useMemo, useState } from "react";
import { Button, buttonCls } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { LoadingBlock, SkeletonList } from "../components/Skeleton";
import { StockBadge } from "../components/ShopBadges";
import { StockDialog } from "../components/StockDialog";
import { AssetFormDialog } from "../components/AssetFormDialog";
import { SummaryCard } from "../components/SummaryCard";
import { useLoading } from "../hooks/useData";
import { useShopView } from "../hooks/useShop";
import type { Product, ShopAsset } from "../shop/types";
import { formatEgp } from "../utils/format";
import { deleteAsset } from "../services/assetsService";
import { useToast } from "../components/Toast";
import { Link } from "react-router";

type Filter = "all" | "low" | "out";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "الكل" },
  { id: "low", label: "منخفض" },
  { id: "out", label: "نفد" },
];

/**
 * المخزون — per-product stock, restock (إدخال), physical count (جرد)
 * and the full رأس المال breakdown: stock at wholesale cost (سعر الجملة ×
 * الكميات) + fixed equipment (ماسح باركود، طابعة…) with its own management.
 */
export function InventoryPage() {
  const view = useShopView();
  const loading = useLoading(view);
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<{ product: Product; mode: "in" | "count" } | undefined>();
  const [assetForm, setAssetForm] = useState<{ open: boolean; asset?: ShopAsset }>({ open: false });
  const [deleting, setDeleting] = useState<ShopAsset | undefined>();
  const [delBusy, setDelBusy] = useState(false);

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

  const costOf = (p: Product): number => p.costPiastres ?? 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingBlock label="جارٍ تحميل المخزون…" />
        <SkeletonList rows={6} />
      </div>
    );
  }
  if (!view) return null;

  const removeAsset = async () => {
    if (!deleting) return;
    setDelBusy(true);
    try {
      await deleteAsset(deleting.id);
      toast.success("تم حذف المعدة");
      setDeleting(undefined);
    } catch {
      toast.error("تعذر حذف المعدة");
    } finally {
      setDelBusy(false);
    }
  };

  const capital = view.capital;

  return (
    <div className="space-y-5">
      <section aria-label="إجماليات المخزون" className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="إجمالي القطع" amount={`${view.totals.pieces}`} tone="brand" icon="box" sub={`${view.totals.products} منتج`} />
        <SummaryCard label="قيمة المخزون" amount={formatEgp(view.totals.stockValue)} tone="cash" icon="wallet" sub="بسعر البيع" />
        <SummaryCard
          label="تحتاج تزويد"
          amount={`${view.low.length}`}
          tone={view.low.length > 0 ? "neg" : "pos"}
          icon="alert"
          sub={view.low.length > 0 ? "نفد أو منخفض" : "كل المنتجات متوفرة"}
        />
      </section>

      {/* ======== رأس المال: stock at wholesale cost + fixed equipment ======== */}
      <section aria-labelledby="capital-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="capital-heading" className="text-lg font-extrabold">
            رأس المال
          </h2>
          <Button type="button" variant="primary" className="h-10" onClick={() => setAssetForm({ open: true })}>
            <Icon name="plus" size={16} />
            إضافة معدة
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="المخزون (بتكلفة الجملة)"
            amount={formatEgp(capital.stockCost)}
            tone="cash"
            icon="box"
            sub="سعر الجملة × الكميات"
          />
          <SummaryCard
            label="المعدات والأجهزة"
            amount={formatEgp(capital.assets)}
            tone="pos"
            icon="barcode"
            sub={`${view.assets.length} معدة`}
          />
          <SummaryCard label="إجمالي رأس المال" amount={formatEgp(capital.total)} tone="brand" icon="wallet" sub="مخزون + معدات" />
        </div>

        {/* Detailed breakdown — per product lines + equipment list */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Stock cost detail */}
          <div className="rounded-lg border border-line bg-card shadow-card">
            <h3 className="border-b border-line px-4 py-3 text-sm font-extrabold text-ink-2">
              تفاصيل تكلفة المخزون
            </h3>
            {capital.lines.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-3">لا توجد منتجات.</p>
            ) : (
              <ul className="max-h-72 divide-y divide-line overflow-y-auto" aria-label="تفاصيل تكلفة المخزون">
                {capital.lines.map((line) => (
                  <li key={line.productId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <p className="min-w-0 truncate text-sm font-bold">{line.name}</p>
                    <p className="shrink-0 text-xs text-ink-3">
                      {line.costPiastres === 0 ? (
                        <span className="text-warn">بدون سعر جملة</span>
                      ) : (
                        <span className="bidi">
                          {line.qty} × {formatEgp(line.costPiastres)}
                        </span>
                      )}
                    </p>
                    <p className={`bidi shrink-0 text-sm font-extrabold ${line.costPiastres === 0 ? "text-ink-3" : ""}`}>
                      {line.costPiastres === 0 ? "—" : formatEgp(line.lineCost)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Equipment (رأس المال الثابت) */}
          <div className="rounded-lg border border-line bg-card shadow-card">
            <h3 className="border-b border-line px-4 py-3 text-sm font-extrabold text-ink-2">
             المعدات والأجهزة (رأس المال الثابت)
            </h3>
            {view.assets.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-3">
                لا توجد معدات بعد — أضف أجهزة المحل (ماسح باركود، طابعة…).
              </p>
            ) : (
              <ul className="max-h-72 divide-y divide-line overflow-y-auto" aria-label="قائمة المعدات">
                {view.assets.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{a.name}</p>
                      {a.note && <p className="truncate text-[11px] text-ink-3">{a.note}</p>}
                    </div>
                    <p className="bidi shrink-0 text-sm font-extrabold">{formatEgp(a.pricePiastres)}</p>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="quiet"
                        className="h-8 px-2"
                        onClick={() => setAssetForm({ open: true, asset: a })}
                        aria-label={`تعديل المعدة ${a.name}`}
                      >
                        <Icon name="edit" size={15} />
                      </Button>
                      <Button
                        type="button"
                        variant="quiet"
                        className="h-8 px-2"
                        onClick={() => setDeleting(a)}
                        aria-label={`حذف المعدة ${a.name}`}
                      >
                        <Icon name="trash" size={15} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
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
                filter === f.id ? "bg-brand text-white" : "text-ink-2 hover:bg-page"
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

      {view.rows.length === 0 ? (
        <EmptyState
          icon="box"
          title="لا توجد منتجات بعد"
          description="سجّل منتجًا لإضافة تكلفة المخزون إلى رأس المال."
          action={
            <Link to="/shop/products" className={buttonCls("primary")}>
              <Icon name="plus" size={16} />
              تسجيل منتج جديد
            </Link>
          }
        />
      ) : rows.length === 0 ? (
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
                {costOf(product) > 0 && (
                  <p className="bidi text-[11px] text-ink-3">
                    جملة: {formatEgp(costOf(product))} · تكلفة الكل: {formatEgp(costOf(product) * Math.max(0, stock))}
                  </p>
                )}
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

      <AssetFormDialog
        open={assetForm.open}
        asset={assetForm.asset}
        onClose={() => setAssetForm({ open: false })}
        onSaved={() => setAssetForm({ open: false })}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title="حذف المعدة؟"
        message={deleting ? `سيحذف «${deleting.name}» من قائمة المعدات. لا يمكن التراجع.` : ""}
        confirmLabel="حذف"
        loading={delBusy}
        onConfirm={removeAsset}
        onClose={() => setDeleting(undefined)}
      />
    </div>
  );
}
