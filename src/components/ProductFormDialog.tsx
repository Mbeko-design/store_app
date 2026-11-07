import { useEffect, useRef, useState } from "react";
import type { Product } from "../shop/types";
import { createProduct, findByBarcode, updateProduct } from "../services/productsService";
import { useProducts } from "../hooks/useShop";
import { normalizeBarcode, parseQty, validateProductForm } from "../validation/shop";
import { piastresToEgp } from "../utils/money";
import { useToast } from "./Toast";
import { Button } from "./Button";
import { Field, inputCls } from "./Field";
import { BarcodeInput } from "./BarcodeInput";
import { Icon } from "./Icon";
import { printBarcodeLabel, reserveBarcodePrintWindow } from "../utils/printBarcodeLabel";

interface FormErrors {
  barcode?: string;
  name?: string;
  price?: string;
  cost?: string;
  qty?: string;
}

/**
 * Register (scan barcode → details) / edit (name + prices — barcode is
 * immutable after registration) a product. Scanning an already-registered
 * barcode offers a shortcut to stock-in instead of failing silently.
 * سعر الجملة (wholesale cost) feeds رأس المال only — POS shows sell price.
 */
export function ProductFormDialog({
  open,
  product,
  barcodePreset = "",
  onClose,
  onSaved,
  onStockInShortcut,
}: {
  open: boolean;
  /** undefined → create mode; otherwise edit mode. */
  product?: Product;
  /** Barcode captured elsewhere (e.g., POS scanned an unknown code). */
  barcodePreset?: string;
  onClose: () => void;
  onSaved?: (saved: Product) => void;
  /** Existing product scanned in create mode → parent opens the stock-in dialog. */
  onStockInShortcut?: (existing: Product) => void;
}) {
  const all = useProducts() ?? [];
  const toast = useToast();
  const nameRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [priceEgp, setPriceEgp] = useState("");
  const [costEgp, setCostEgp] = useState("");
  const [initialQty, setInitialQty] = useState("0");
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<Product | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSaving(false);
    setExisting(null);
    setBarcode(product ? product.barcode : barcodePreset);
    setName(product?.name ?? "");
    setPriceEgp(product ? String(piastresToEgp(product.pricePiastres)) : "");
    setCostEgp(product ? String(piastresToEgp(product.costPiastres ?? 0)) : "");
    setInitialQty("0");
  }, [open, product, barcodePreset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const onScan = async (code: string) => {
    const normalized = normalizeBarcode(code);
    const found = await findByBarcode(normalized).catch(() => undefined);
    if (found) {
      setExisting(found);
      setErrors((e) => ({ ...e, barcode: undefined }));
      return;
    }
    setExisting(null);
    setBarcode(normalized);
    setErrors((e) => ({ ...e, barcode: undefined }));
    nameRef.current?.focus();
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (saving) return; // double-submit guard

    if (product) {
      // Edit: name + sell/wholesale prices (barcode shown read-only).
      const { errors: errs, values } = validateProductForm(
        { barcode: product.barcode, name, priceEgp, costEgp },
        all,
        product.id,
      );
      setErrors(errs);
      if (!values) return;
      setSaving(true);
      try {
        const saved = await updateProduct(product.id, {
          name: values.name,
          pricePiastres: values.pricePiastres,
          costPiastres: values.costPiastres,
        });
        toast.success("تم تحديث المنتج");
        onSaved?.(saved);
        onClose();
      } catch {
        toast.error("تعذر حفظ المنتج");
      } finally {
        setSaving(false);
      }
      return;
    }

    const qty = parseQty(initialQty);
    const { errors: errs, values } = validateProductForm({ barcode, name, priceEgp, costEgp }, all);
    const allErrors: FormErrors = { ...errs };
    if (!qty.ok) allErrors.qty = qty.error;
    setErrors(allErrors);
    if (!values || !qty.ok) return;

    const printWindow = qty.qty > 0 ? reserveBarcodePrintWindow() : null;
    setSaving(true);
    try {
      const saved = await createProduct({ ...values, initialQty: qty.qty });
      toast.success("تم تسجيل المنتج");
      if (qty.qty > 0) {
        if (printWindow) {
          try {
            await printBarcodeLabel(printWindow, saved, qty.qty);
          } catch (error) {
            console.error("barcode label printing failed:", error);
            printWindow.close();
            toast.error("تم تسجيل المنتج، لكن تعذرت طباعة الملصقات. يمكنك المحاولة من قائمة المنتجات.");
          }
        } else {
          toast.error("تم تسجيل المنتج. اسمح بالنوافذ المنبثقة لإعادة طباعة ملصقاته من قائمة المنتجات.");
        }
      }
      onSaved?.(saved);
      onClose();
    } catch (err) {
      printWindow?.close();
      if (err instanceof Error && err.message === "duplicate_barcode") {
        setErrors((e) => ({ ...e, barcode: "هذا الباركود مسجل لمنتج آخر" }));
      } else {
        toast.error("تعذر حفظ المنتج");
      }
    } finally {
      setSaving(false);
    }
  };

  const isEdit = Boolean(product);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-brand/45" onClick={() => !saving && onClose()} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prod-form-title"
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-lg border border-line bg-card p-5 shadow-pop"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="prod-form-title" className="text-lg font-extrabold">
            {isEdit ? "تعديل المنتج" : "تسجيل منتج جديد"}
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

        <form onSubmit={submit} noValidate className="mt-4 space-y-4">
          {isEdit ? (
            <div>
              <span className="mb-2 block text-sm font-bold text-ink-2">الباركود</span>
              <p
                dir="ltr"
                className="flex h-11 items-center rounded-md border border-line bg-page px-3 font-mono text-sm font-bold text-ink-2"
              >
                {product!.barcode}
              </p>
              <p className="mt-1.5 text-xs text-ink-3">الباركود لا يتغيّر بعد التسجيل.</p>
            </div>
          ) : (
            <>
              <BarcodeInput
                id="prod-barcode"
                value={barcode}
                onValueChange={(v) => {
                  setBarcode(v);
                  setErrors((e) => ({ ...e, barcode: undefined }));
                }}
                onScan={onScan}
                error={errors.barcode}
                autoFocus={!barcodePreset}
                hint="امسح الباركود أو اتركه فارغًا لتوليد رقم داخلي. ستتم طباعة ملصق لكل قطعة في الكمية الابتدائية."
              />
              {existing && (
                <div className="rounded-md border border-warn-line bg-warn-bg p-3 text-sm text-warn" role="alert">
                  <p className="flex items-center gap-2 font-bold">
                    <Icon name="alert" size={16} />
                    {existing.archivedAtIso ? "منتج مؤرشف بهذا الباركود: " : "منتج مسجّل بهذا الباركود: "}
                    {existing.name}
                  </p>
                  {onStockInShortcut && !existing.archivedAtIso && (
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 bg-card"
                        onClick={() => {
                          const p = existing;
                          setExisting(null);
                          onStockInShortcut(p);
                        }}
                      >
                        <Icon name="plus" size={14} />
                        إدخال كمية
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <Field label="اسم المنتج" htmlFor="prod-name" error={errors.name} required>
            <input
              ref={nameRef}
              id="prod-name"
              type="text"
              value={name}
              maxLength={60}
              autoComplete="off"
              placeholder="مثال: كفر شفاف iPhone 13"
              onChange={(e) => {
                setName(e.target.value);
                setErrors((er) => ({ ...er, name: undefined }));
              }}
              aria-invalid={errors.name ? true : undefined}
              className={`${inputCls} ${errors.name ? "border-neg" : ""}`}
            />
          </Field>

          <Field label="سعر البيع" htmlFor="prod-price" error={errors.price} required hint="بالجنيه — يُستخدم في الفواتير">
            <input
              id="prod-price"
              type="text"
              inputMode="decimal"
              value={priceEgp}
              placeholder="مثال: 120"
              onChange={(e) => {
                setPriceEgp(e.target.value);
                setErrors((er) => ({ ...er, price: undefined }));
              }}
              aria-invalid={errors.price ? true : undefined}
              className={`${inputCls} ${errors.price ? "border-neg" : ""}`}
            />
          </Field>

          <Field label="سعر الجملة" htmlFor="prod-cost" error={errors.cost} required hint="لحساب رأس المال فقط — لا تظهر في نقطة البيع">
            <input
              id="prod-cost"
              type="text"
              inputMode="decimal"
              value={costEgp}
              placeholder="مثال: 90"
              onChange={(e) => {
                setCostEgp(e.target.value);
                setErrors((er) => ({ ...er, cost: undefined }));
              }}
              aria-invalid={errors.cost ? true : undefined}
              className={`${inputCls} ${errors.cost ? "border-neg" : ""}`}
            />
          </Field>

          {!isEdit && (
            <Field
              label="الكمية الابتدائية"
              htmlFor="prod-qty"
              error={errors.qty}
              hint="عدد القطع الموجودة الآن؛ ستُطبع ملصقات بالعدد نفسه (0 = دون طباعة)"
            >
              <input
                id="prod-qty"
                type="text"
                inputMode="numeric"
                value={initialQty}
                onChange={(e) => {
                  setInitialQty(e.target.value);
                  setErrors((er) => ({ ...er, qty: undefined }));
                }}
                aria-invalid={errors.qty ? true : undefined}
                className={`${inputCls} ${errors.qty ? "border-neg" : ""}`}
              />
            </Field>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" className="flex-1" loading={saving}>
              {isEdit ? "حفظ التعديلات" : "تسجيل المنتج"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
