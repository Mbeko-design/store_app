import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { ProductFormDialog } from "../components/ProductFormDialog";
import { StockBadge } from "../components/ShopBadges";
import { SkeletonList, LoadingBlock } from "../components/Skeleton";
import { StockDialog } from "../components/StockDialog";
import { useLoading } from "../hooks/useData";
import { useShopView } from "../hooks/useShop";
import type { Product } from "../shop/types";
import { formatEgp } from "../utils/format";

/** المنتجات — catalog list, search, register (scan) / edit, stock shortcuts. */
export function ProductsPage() {
  const view = useShopView();
  const loading = useLoading(view);

  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>(undefined);
  const [presetBarcode, setPresetBarcode] = useState("");
  const [stockTarget, setStockTarget] = useState<{ product: Product; mode: "in" | "count" } | undefined>();

  const rows = useMemo(() => {
    if (!view) return [];
    const q = query.trim().toLowerCase();
    if (!q) return view.rows;
    return view.rows.filter(
      (r) => r.product.name.toLowerCase().includes(q) || r.product.barcode.toLowerCase().includes(q),
    );
  }, [view, query]);

  const openCreate = () => {
    setEditing(undefined);
    setPresetBarcode("");
    setFormOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingBlock label="جارٍ تحميل المنتجات…" />
        <SkeletonList rows={6} />
      </div>
    );
  }
  if (!view) return null;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Icon name="filter" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            id="prod-search"
            type="search"
            value={query}
            placeholder="ابحث بالاسم أو الباركود…"
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-md border border-line bg-card ps-9 pe-3 text-base"
          />
        </div>
        <Button type="button" variant="primary" onClick={openCreate}>
          <Icon name="plus" size={16} />
          تسجيل منتج جديد
        </Button>
      </div>

      {view.rows.length === 0 ? (
        <EmptyState
          icon="box"
          title="لا توجد منتجات بعد"
          description="سجّل أول منتج: امسح الباركود ثم أدخل الاسم والسعر."
          action={
            <Button type="button" variant="primary" onClick={openCreate}>
              <Icon name="plus" size={16} />
              تسجيل منتج جديد
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState icon="filter" title="لا نتائج للبحث" description={`لا يوجد منتج يطابق «${query}».`} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="قائمة المنتجات">
          {rows.map(({ product, stock, status }) => (
            <li key={product.id} className="flex flex-col rounded-lg border border-line bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-extrabold">{product.name}</h3>
                  <p dir="ltr" className="mt-1 text-start font-mono text-xs text-ink-3">
                    {product.barcode}
                  </p>
                </div>
                <StockBadge status={status} />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-page p-2.5">
                  <dt className="text-xs text-ink-3">سعر البيع</dt>
                  <dd className="bidi font-extrabold text-ink">{formatEgp(product.pricePiastres)}</dd>
                </div>
                <div className="rounded-md bg-page p-2.5">
                  <dt className="text-xs text-ink-3">المتوفر</dt>
                  <dd className="bidi font-extrabold text-ink">{stock} قطعة</dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="quiet"
                  className="h-9 flex-1 px-2"
                  onClick={() => setStockTarget({ product, mode: "in" })}
                >
                  <Icon name="plus" size={14} />
                  إدخال مخزون
                </Button>
                <Button
                  type="button"
                  variant="quiet"
                  className="h-9 flex-1 px-2"
                  onClick={() => setStockTarget({ product, mode: "count" })}
                >
                  <Icon name="list" size={14} />
                  جرد
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-2"
                  aria-label={`تعديل ${product.name}`}
                  onClick={() => {
                    setEditing(product);
                    setPresetBarcode("");
                    setFormOpen(true);
                  }}
                >
                  <Icon name="edit" size={14} />
                  تعديل
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ProductFormDialog
        open={formOpen}
        product={editing}
        barcodePreset={presetBarcode}
        onClose={() => setFormOpen(false)}
        onStockInShortcut={(existing) => {
          setFormOpen(false);
          setStockTarget({ product: existing, mode: "in" });
        }}
      />
      <StockDialog
        open={Boolean(stockTarget)}
        mode={stockTarget?.mode ?? "in"}
        product={stockTarget?.product}
        stock={view.rows.find((r) => r.product.id === stockTarget?.product.id)?.stock ?? 0}
        onClose={() => setStockTarget(undefined)}
      />
    </div>
  );
}
