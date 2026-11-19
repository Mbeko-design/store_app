import { useEffect, useState } from "react";
import type { Product } from "../shop/types";
import { parseQty } from "../validation/shop";
import { printBarcodeLabel, reserveBarcodePrintWindow } from "../utils/printBarcodeLabel";
import { Button } from "./Button";
import { Field, inputCls } from "./Field";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

export function BarcodeLabelDialog({
  product,
  stock,
  onClose,
}: {
  product: Product | undefined;
  stock: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const [copies, setCopies] = useState("1");
  const [error, setError] = useState<string | undefined>();
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!product) return;
    setCopies("1");
    setError(undefined);
    setPrinting(false);
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !printing) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [product, printing, onClose]);

  if (!product) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (printing) return;

    const parsed = parseQty(copies);
    if (!parsed.ok || parsed.qty < 1) {
      setError(parsed.ok ? "عدد الملصقات يجب أن يكون 1 على الأقل" : parsed.error);
      return;
    }

    const printWindow = reserveBarcodePrintWindow();
    if (!printWindow) {
      toast.error("اسمح بالنوافذ المنبثقة لطباعة ملصق الباركود.");
      return;
    }

    setPrinting(true);
    try {
      await printBarcodeLabel(printWindow, product, parsed.qty);
      toast.success(`تم تجهيز ${parsed.qty} ملصق للطباعة`);
      onClose();
    } catch (printError) {
      console.error("barcode label printing failed:", printError);
      printWindow.close();
      toast.error("تعذرت طباعة ملصقات الباركود.");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-brand/45" onClick={() => !printing && onClose()} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="barcode-label-title"
        className="relative w-full max-w-sm rounded-lg border border-line bg-card p-5 shadow-pop"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand/10 text-brand">
            <Icon name="barcode" size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="barcode-label-title" className="text-lg font-extrabold">طباعة ملصقات الباركود</h2>
            <p className="mt-1 truncate text-sm font-bold text-ink-2">{product.name}</p>
            <p dir="ltr" className="mt-1 text-start font-mono text-xs text-ink-3">{product.barcode}</p>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="mt-4 space-y-4">
          <p className="rounded-md border border-line bg-page p-3 text-sm text-ink-2">
            المتوفر في المخزون: <strong className="bidi">{stock}</strong> قطعة. عدد الملصقات لا يغيّر المخزون.
          </p>
          <Field
            label="عدد الملصقات المطلوب طباعتها"
            htmlFor="barcode-label-copies"
            error={error}
            required
            hint="أدخل العدد المطلوب، مثل 5 حتى لو كان المخزون 200."
          >
            <input
              id="barcode-label-copies"
              type="text"
              inputMode="numeric"
              autoFocus
              value={copies}
              onChange={(event) => {
                setCopies(event.target.value);
                setError(undefined);
              }}
              aria-invalid={error ? true : undefined}
              className={`${inputCls} ${error ? "border-neg" : ""}`}
            />
          </Field>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={printing}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" className="flex-1" loading={printing}>
              طباعة
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
