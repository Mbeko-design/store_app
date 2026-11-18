import { useEffect, useState } from "react";
import { useProducts } from "../hooks/useShop";
import type { Product } from "../shop/types";
import { saveSupplierInvoice } from "../services/supplierInvoicesService";
import { parseAmountInput } from "../validation/money";
import { egpToPiastres, piastresToEgp } from "../utils/money";
import { formatEgp } from "../utils/format";
import { Button } from "./Button";
import { Field, inputCls } from "./Field";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

interface InvoiceLineState {
  productId: string;
  qty: string;
  costEgp: string;
}

export function SupplierInvoiceDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const products = useProducts() ?? [];
  const toast = useToast();
  const [supplierName, setSupplierName] = useState("");
  const [reference, setReference] = useState("");
  const [paidEgp, setPaidEgp] = useState("0");
  const [lines, setLines] = useState<InvoiceLineState[]>([
    { productId: "", qty: "1", costEgp: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSupplierName("");
    setReference("");
    setPaidEgp("0");
    setLines([{ productId: "", qty: "1", costEgp: "" }]);
    setSaving(false);
    setError("");
  }, [open]);

  if (!open) return null;

  const updateLine = (index: number, patch: Partial<InvoiceLineState>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
    setError("");
  };

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (saving) return;
    if (!supplierName.trim()) {
      setError("اسم المورد مطلوب");
      return;
    }

    const parsedLines: Array<{ productId: string; qty: number; unitCostPiastres: number }> = [];
    for (const line of lines) {
      if (!line.productId) {
        setError("اختر المنتج لكل سطر");
        return;
      }
      if (!/^\d+$/.test(line.qty.trim()) || Number(line.qty) < 1) {
        setError("الكمية يجب أن تكون عددًا صحيحًا أكبر من صفر");
        return;
      }
      const cost = parseAmountInput(line.costEgp);
      if (!cost.ok) {
        setError(cost.error);
        return;
      }
      parsedLines.push({
        productId: line.productId,
        qty: Number(line.qty),
        unitCostPiastres: cost.piastres,
      });
    }

    let paidPiastres = 0;
    const paidTrimmed = paidEgp.trim();
    const normalizedPaid = paidTrimmed
      .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٬,.\s٫]/g, "");
    if (normalizedPaid && normalizedPaid !== "0") {
      const paid = parseAmountInput(paidTrimmed);
      if (!paid.ok) {
        setError(paid.error);
        return;
      }
      paidPiastres = paid.piastres;
    } else if (paidTrimmed && !/^[\d٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹.,\s٫٬]+$/.test(paidTrimmed)) {
      setError("أدخل المبلغ المدفوع بصورة صحيحة");
      return;
    }

    setSaving(true);
    try {
      await saveSupplierInvoice({
        supplierName,
        reference,
        lines: parsedLines,
        paidPiastres,
      });
      toast.success("تم تسجيل فاتورة المورد وإدخال الكميات للمخزون");
      onClose();
    } catch (err) {
      if (err instanceof Error && err.message === "paid_exceeds_total") {
        setError("المبلغ المدفوع أكبر من إجمالي الفاتورة");
      } else if (err instanceof Error && err.message === "invalid_supplier") {
        setError("اسم المورد مطلوب وبحد أقصى 80 حرفًا");
      } else {
        toast.error("تعذر تسجيل فاتورة المورد");
      }
    } finally {
      setSaving(false);
    }
  };

  const estimatedTotal = lines.reduce((sum, line) => {
    const cost = line.costEgp.trim().replace(/[٬,]/g, "").replace(/[٫]/g, ".");
    const qty = Number(line.qty);
    if (!/^\d+$/.test(line.qty.trim()) || qty < 1 || !cost) return sum;
    const value = Number(cost);
    if (!Number.isFinite(value) || value <= 0) return sum;
    return sum + egpToPiastres(value) * qty;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-brand/45" onClick={() => !saving && onClose()} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-invoice-title"
        className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-lg border border-line bg-card p-5 shadow-pop"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="supplier-invoice-title" className="text-lg font-extrabold">فاتورة مورد جديدة</h2>
          <button type="button" onClick={onClose} disabled={saving} className="grid size-10 place-items-center rounded-md text-ink-3 hover:bg-page" aria-label="إغلاق">
            <Icon name="close" size={20} />
          </button>
        </div>

        <form onSubmit={submit} noValidate className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="اسم المورد" htmlFor="invoice-supplier" required>
              <input id="invoice-supplier" value={supplierName} maxLength={80} onChange={(e) => setSupplierName(e.target.value)} placeholder="اسم المورد" className={inputCls} />
            </Field>
            <Field label="رقم فاتورة المورد (اختياري)" htmlFor="invoice-reference">
              <input id="invoice-reference" value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} placeholder="مثال: INV-1024" className={inputCls} />
            </Field>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold">المنتجات</h3>
              <Button type="button" variant="secondary" className="h-9" onClick={() => setLines((current) => [...current, { productId: "", qty: "1", costEgp: "" }])}>
                <Icon name="plus" size={14} />
                إضافة منتج
              </Button>
            </div>

            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-[1fr_90px_120px_40px]">
                <div>
                  <label className="mb-1 block text-xs font-bold text-ink-2">المنتج</label>
                  <select
                    value={line.productId}
                    onChange={(e) => {
                      const productId = e.target.value;
                      const product = products.find((item) => item.id === productId) as Product | undefined;
                      updateLine(index, {
                        productId,
                        costEgp: product?.costPiastres ? String(piastresToEgp(product.costPiastres)) : line.costEgp,
                      });
                    }}
                    className={`${inputCls} px-2`}
                  >
                    <option value="">اختر منتجًا</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-ink-2">الكمية</label>
                  <input type="text" inputMode="numeric" value={line.qty} onChange={(e) => updateLine(index, { qty: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-ink-2">سعر الجملة</label>
                  <input type="text" inputMode="decimal" value={line.costEgp} onChange={(e) => updateLine(index, { costEgp: e.target.value })} placeholder="جنيه" className={inputCls} />
                </div>
                <Button type="button" variant="quiet" className="mt-6 h-11 px-2" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))} aria-label="حذف سطر المنتج">
                  <Icon name="trash" size={15} />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md bg-page p-3">
              <p className="text-xs font-bold text-ink-3">إجمالي الفاتورة</p>
              <p className="mt-1 bidi text-xl font-extrabold">{formatEgp(estimatedTotal)}</p>
            </div>
            <Field label="المبلغ المدفوع" htmlFor="invoice-paid" hint="اتركه 0 إذا لم يتم دفع أي مبلغ">
              <input id="invoice-paid" type="text" inputMode="decimal" value={paidEgp} onChange={(e) => { setPaidEgp(e.target.value); setError(""); }} className={inputCls} />
            </Field>
          </div>

          {error && <p role="alert" className="rounded-md border border-neg-line bg-neg-bg p-3 text-sm font-bold text-neg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>إلغاء</Button>
            <Button type="submit" variant="primary" className="flex-1" loading={saving}>حفظ الفاتورة</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
