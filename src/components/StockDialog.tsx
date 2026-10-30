import { useEffect, useState } from "react";
import type { Product } from "../shop/types";
import { applyStockCount, stockIn } from "../services/productsService";
import { parseCountQty, parseStockInQty } from "../validation/shop";
import { useToast } from "./Toast";
import { Button } from "./Button";
import { Field, inputCls } from "./Field";
import { Icon } from "./Icon";

/**
 * Stock dialog — two modes:
 *  - "in":   supplier delivery / restock (adds a positive qty)
 *  - "count": physical inventory count → stores the signed correction
 * Both write StockMoves through the service (stock math stays pure in src/shop/).
 */
export function StockDialog({
  open,
  mode,
  product,
  stock,
  onClose,
}: {
  open: boolean;
  mode: "in" | "count";
  product: Product | undefined;
  /** Current on-hand for this product (from the pure stock table). */
  stock: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const [qty, setQty] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQty(mode === "count" ? String(stock) : "");
    setError(undefined);
    setSaving(false);
  }, [open, mode, stock]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open || !product) return null;

  const parsed = mode === "in" ? parseStockInQty(qty) : parseCountQty(qty);
  const delta = parsed.ok ? parsed.qty - stock : null;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (saving) return; // double-submit guard
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    try {
      if (mode === "in") {
        await stockIn(product.id, qty);
        toast.success(`تم إدخال ${parsed.qty} قطعة للمخزون`);
      } else {
        const res = await applyStockCount(product.id, parsed.qty);
        toast.success(
          res.delta === 0 ? "الجرد مطابق — لا يوجد تغيير" : `تم تعديل الرصيد (${res.delta > 0 ? "+" : ""}${res.delta})`,
        );
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error && err.message === "not_found" ? "المنتج غير موجود" : "تعذر حفظ الحركة");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy/45" onClick={() => !saving && onClose()} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-dialog-title"
        className="relative w-full max-w-sm rounded-lg border border-line bg-card p-5 shadow-pop"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="stock-dialog-title" className="text-lg font-extrabold">
            {mode === "in" ? "إدخال مخزون" : "جرد — الكمية الفعلية"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="grid size-10 place-items-center rounded-md text-ink-3 hover:bg-page"
            aria-label="إغلاق"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="mt-3 rounded-md border border-line bg-page p-3 text-sm">
          <p className="font-bold">{product.name}</p>
          <p dir="ltr" className="mt-0.5 text-start font-mono text-xs text-ink-3">
            {product.barcode}
          </p>
          <p className="mt-1 text-xs text-ink-2">
            الرصيد الحالي: <span className="bidi font-bold">{stock}</span> قطعة
          </p>
        </div>

        <form onSubmit={submit} noValidate className="mt-4 space-y-4">
          <Field
            label={mode === "in" ? "الكمية الواردة" : "الكمية المعدودة فعليًا"}
            htmlFor="stock-qty"
            error={error}
            required
            hint={mode === "in" ? "عدد القطع المضافة إلى المخزون" : "العدد المعدود — يُسجَّل فرقًا عن الرصيد الحالي"}
          >
            <input
              id="stock-qty"
              type="text"
              inputMode="numeric"
              autoFocus
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                setError(undefined);
              }}
              aria-invalid={error ? true : undefined}
              className={`${inputCls} ${error ? "border-neg" : ""}`}
            />
          </Field>

          {mode === "count" && delta !== null && (
            <p
              className={`flex items-center gap-2 rounded-md border p-2.5 text-sm font-bold ${
                delta === 0
                  ? "border-pos-line bg-pos-bg text-pos"
                  : delta > 0
                    ? "border-cash-line bg-cash-bg text-cash"
                    : "border-neg-line bg-neg-bg text-neg"
              }`}
            >
              <Icon name={delta === 0 ? "checkCircle" : delta > 0 ? "arrowUp" : "arrowDown"} size={16} />
              {delta === 0 ? "مطابق للرصيد الحالي" : `التغيير: ${delta > 0 ? "+" : ""}${delta} قطعة`}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" className="flex-1" loading={saving}>
              {mode === "in" ? "إدخال الكمية" : "حفظ الجرد"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
