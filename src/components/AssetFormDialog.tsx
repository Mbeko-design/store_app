import { useEffect, useState } from "react";
import type { ShopAsset } from "../shop/types";
import { createAsset, updateAsset } from "../services/assetsService";
import { parseAmountInput } from "../validation/money";
import { piastresToEgp } from "../utils/money";
import { useToast } from "./Toast";
import { Button } from "./Button";
import { Field, inputCls } from "./Field";
import { Icon } from "./Icon";

interface FormErrors {
  name?: string;
  price?: string;
}

/**
 * Equipment/asset dialog (رأس المال الثابت): add or edit a fixed asset
 * (ماسح باركود, طابعة, أرفف…). Cost feeds the capital breakdown only.
 */
export function AssetFormDialog({
  open,
  asset,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** undefined → create mode; otherwise edit mode. */
  asset?: ShopAsset;
  onClose: () => void;
  onSaved?: (saved: ShopAsset) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [priceEgp, setPriceEgp] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSaving(false);
    setName(asset?.name ?? "");
    setPriceEgp(asset ? String(piastresToEgp(asset.pricePiastres)) : "");
    setNote(asset?.note ?? "");
  }, [open, asset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (saving) return;
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = "اسم المعدة مطلوب";
    const amount = parseAmountInput(priceEgp);
    if (!amount.ok) errs.price = amount.error;
    setErrors(errs);
    if (Object.keys(errs).length > 0 || !amount.ok) return;

    setSaving(true);
    try {
      const saved = asset
        ? await updateAsset(asset.id, { name, pricePiastres: amount.piastres, note })
        : await createAsset({ name, pricePiastres: amount.piastres, note });
      toast.success(asset ? "تم تحديث المعدة" : "تمت إضافة المعدة");
      onSaved?.(saved);
      onClose();
    } catch {
      toast.error("تعذر حفظ المعدة");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-brand/45" onClick={() => !saving && onClose()} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-form-title"
        className="relative w-full max-w-sm rounded-lg border border-line bg-card p-5 shadow-pop"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="asset-form-title" className="text-lg font-extrabold">
            {asset ? "تعديل المعدة" : "إضافة معدة / جهاز"}
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
          <Field label="اسم المعدة" htmlFor="asset-name" error={errors.name} required hint="مثال: ماسح باركود USB">
            <input
              id="asset-name"
              type="text"
              maxLength={60}
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((er) => ({ ...er, name: undefined }));
              }}
              aria-invalid={errors.name ? true : undefined}
              className={`${inputCls} ${errors.name ? "border-neg" : ""}`}
            />
          </Field>

          <Field label="السعر (ثمن الشراء)" htmlFor="asset-price" error={errors.price} required hint="بالجنيه — يدخل في رأس المال">
            <input
              id="asset-price"
              type="text"
              inputMode="decimal"
              value={priceEgp}
              placeholder="مثال: 1200"
              onChange={(e) => {
                setPriceEgp(e.target.value);
                setErrors((er) => ({ ...er, price: undefined }));
              }}
              aria-invalid={errors.price ? true : undefined}
              className={`${inputCls} ${errors.price ? "border-neg" : ""}`}
            />
          </Field>

          <Field label="ملاحظة (اختياري)" htmlFor="asset-note">
            <input
              id="asset-note"
              type="text"
              maxLength={80}
              value={note}
              placeholder="مثال: شراء 2024 — ضمان سنة"
              onChange={(e) => setNote(e.target.value)}
              className={inputCls}
            />
          </Field>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" className="flex-1" loading={saving}>
              {asset ? "حفظ التعديلات" : "إضافة المعدة"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
