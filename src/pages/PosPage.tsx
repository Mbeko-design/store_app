import { useMemo, useRef, useState } from "react";
import {
  addToCart,
  cartCount,
  cartTotal,
  removeLine,
  setLineQty,
  totalAfterDiscount,
  type CartLine,
  type PaymentMethod,
  type Product,
  type Receipt,
} from "../shop";
import { PAYMENT_LABEL } from "../shop/types";
import { findByBarcode } from "../services/productsService";
import { isValidBarcode } from "../validation/shop";
import { saveReceipt } from "../services/receiptsService";
import { useShopView } from "../hooks/useShop";
import { BarcodeInput } from "../components/BarcodeInput";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { ProductFormDialog } from "../components/ProductFormDialog";
import { PaymentBadge } from "../components/ShopBadges";
import { ReceiptPrintButton } from "../components/ReceiptPrintButton";
import { Field, inputCls } from "../components/Field";
import { useToast } from "../components/Toast";
import { formatEgp, formatTime } from "../utils/format";
import { parseAmountInput } from "../validation/money";

const METHODS: PaymentMethod[] = ["cash", "vodafone"];

/**
 * نقطة البيع — scan → cart → save.
 * USB scanner types the barcode + Enter; re-scanning increments qty.
 * Saving writes the receipt + stock moves atomically (service re-checks stock).
 */
export function PosPage() {
  const view = useShopView();
  const toast = useToast();
  const scanRef = useRef<HTMLInputElement>(null);

  const [scanValue, setScanValue] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountError, setDiscountError] = useState<string | undefined>();
  const [scanError, setScanError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Receipt | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);

  const stockOf = useMemo(() => {
    const map = new Map(view?.rows.map((r) => [r.product.id, r.stock]) ?? []);
    return (id: string) => map.get(id) ?? 0;
  }, [view]);

  const searchResults = useMemo(() => {
    const query = scanValue.trim().toLocaleLowerCase();
    if (!query || !view) return [];
    return view.rows
      .filter(({ product }) =>
        product.name.toLocaleLowerCase().includes(query) || product.barcode.toLocaleLowerCase().startsWith(query),
      )
      .slice(0, 8);
  }, [scanValue, view]);

  const focusScan = () => requestAnimationFrame(() => scanRef.current?.focus());
  const subtotalPiastres = cartTotal(cart);
  const parsedDiscount = discountAmount.trim() ? parseAmountInput(discountAmount) : undefined;
  const discountPiastres = parsedDiscount?.ok ? parsedDiscount.piastres : 0;
  const discountTooLarge = discountPiastres > subtotalPiastres;
  const finalTotalPiastres = discountTooLarge ? 0 : totalAfterDiscount(subtotalPiastres, discountPiastres);
  const discountInputError =
    discountError ??
    (discountAmount.trim() && parsedDiscount && !parsedDiscount.ok
      ? parsedDiscount.error
      : discountTooLarge
        ? "قيمة الخصم لا يمكن أن تكون أكبر من إجمالي الفاتورة"
        : undefined);

  const addProduct = (product: Product) => {
    setScanValue("");
    setUnknownBarcode(null);
    if (product.archivedAtIso) {
      setScanError(`الصنف «${product.name}» مؤرشف — أعده من قائمة المنتجات قبل البيع`);
      return;
    }
    // Any new scan dismisses the "saved receipt" panel → fresh receipt.
    const baseCart = saved ? [] : cart;
    if (saved) {
      setSaved(null);
      setDiscountAmount("");
      setDiscountError(undefined);
    }

    const res = addToCart(baseCart, product, stockOf(product.id));
    if (res.error === "out_of_stock") {
      setScanError(`الكمية غير متاحة — «${product.name}» المتبقي: ${stockOf(product.id)}`);
      return;
    }
    setCart(res.cart);
    setScanError(undefined);
  };

  const onScan = async (query: string) => {
    if (!view) return;
    setScanError(undefined);
    const product = await findByBarcode(query).catch(() => undefined);
    if (product) {
      addProduct(product);
      return;
    }

    const normalizedQuery = query.trim().toLocaleLowerCase();
    const hasSuggestions = view.rows.some(
      ({ product: item }) =>
        item.name.toLocaleLowerCase().includes(normalizedQuery) ||
        item.barcode.toLocaleLowerCase().startsWith(normalizedQuery),
    );
    if (hasSuggestions) return;

    if (isValidBarcode(query)) {
      setScanValue("");
      setUnknownBarcode(query);
      return;
    }
    setScanError("لا يوجد منتج بهذا الاسم أو بداية الباركود");
  };

  const submit = async () => {
    if (saving || cart.length === 0) return; // double-submit guard
    if (discountAmount.trim() && (!parsedDiscount?.ok || parsedDiscount.piastres > subtotalPiastres)) {
      setDiscountError(
        parsedDiscount && !parsedDiscount.ok
          ? parsedDiscount.error
          : "قيمة الخصم لا يمكن أن تكون أكبر من إجمالي الفاتورة",
      );
      return;
    }
    setDiscountError(undefined);
    setSaving(true);
    try {
      const receipt = await saveReceipt({
        lines: cart,
        paymentMethod: method,
        ...(discountPiastres > 0 ? { discountPiastres } : {}),
      });
      setSaved(receipt);
      setCart([]);
      setDiscountAmount("");
      setScanError(undefined);
      toast.success(`تم حفظ الفاتورة رقم ${receipt.number}`);
      focusScan();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "invalid_discount") {
        setDiscountError("قيمة الخصم غير صحيحة أو أكبر من إجمالي الفاتورة");
      } else if (code === "insufficient_stock" || code === "product_missing" || code === "product_archived") {
        toast.error(
          code === "product_archived"
            ? "تمت أرشفة أحد الأصناف — أعده من قائمة المنتجات قبل البيع"
            : "الكمية المتاحة تغيّرت — راجع الأسطر وحاول مجددًا",
        );
        setCart([]); // stale cart — start clean (live data has refreshed)
      } else {
        toast.error("تعذر حفظ الفاتورة");
      }
    } finally {
      setSaving(false);
    }
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount("");
    setDiscountError(undefined);
    setScanError(undefined);
    focusScan();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Scan field */}
      <section aria-label="مسح الباركود" className="rounded-lg border border-line bg-card p-4 shadow-card">
        <BarcodeInput
          id="pos-scan"
          value={scanValue}
          onValueChange={(v) => {
            setScanValue(v);
            setScanError(undefined);
            if (saved) setSaved(null); // typing starts a new receipt
          }}
          onScan={onScan}
          clearOnScan={false}
          inputRef={scanRef}
          big
          autoFocus
          label=""
          placeholder="امسح الباركود أو ابحث بالاسم/أول أرقام الباركود…"
        />
        <p className="mt-2 text-xs text-ink-3">
          امسح الباركود كاملًا لإضافة المنتج، أو ابحث بالاسم أو بداية الباركود واختر المنتج من النتائج.
        </p>

        {searchResults.length > 0 && (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-md border border-line bg-card" aria-label="نتائج البحث عن المنتجات">
            {searchResults.map(({ product, stock }) => (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={stock <= 0}
                  onClick={() => addProduct(product)}
                  className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-start hover:bg-page disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{product.name}</span>
                    <span dir="ltr" className="block text-start font-mono text-xs text-ink-3">{product.barcode}</span>
                  </span>
                  <span className="bidi shrink-0 text-xs text-ink-2">
                    {stock > 0 ? `${stock} متاح · ${formatEgp(product.pricePiastres)}` : "نفد المخزون"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {scanError && (
          <div
            className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-neg-line bg-neg-bg p-3 text-sm font-bold text-neg"
            role="alert"
          >
            <Icon name="alert" size={16} className="shrink-0" />
            <span className="min-w-0 flex-1">{scanError}</span>
          </div>
        )}

        {/* Unknown barcode → registration dialog opens immediately (prefilled). */}
        {unknownBarcode && (
          <ProductFormDialog
            open={true}
            barcodePreset={unknownBarcode}
            onClose={() => {
              // Keep «باركود غير مسجل» visible after dismissing the dialog.
              setUnknownBarcode(null);
              focusScan();
            }}
            onSaved={(p) => {
              setUnknownBarcode(null);
              setScanError(undefined);
              toast.success(`تم تسجيل «${p.name}» — امسحه الآن لإضافته`);
              focusScan();
            }}
          />
        )}
      </section>

      {/* Saved receipt panel */}
      {saved && (
        <section aria-label="تم حفظ الفاتورة" className="rounded-lg border border-pos-line bg-pos-bg p-4">
          <p className="flex items-center gap-2 font-extrabold text-pos">
            <Icon name="checkCircle" size={20} />
            تم حفظ الفاتورة رقم <span className="bidi">#{saved.number}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
            <span className="bidi font-extrabold text-pos">{formatEgp(saved.totalPiastres)}</span>
            <span>
              <span className="bidi">{saved.lines.reduce((s, l) => s + l.qty, 0)}</span> قطعة
            </span>
            <PaymentBadge method={saved.paymentMethod} />
            <span className="bidi font-mono text-xs">{formatTime(saved.createdAtIso)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ReceiptPrintButton receipt={saved} />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSaved(null);
                setDiscountAmount("");
              }}
            >
              فاتورة جديدة
            </Button>
          </div>
        </section>
      )}

      {/* Cart */}
      <section aria-label="أسطر الفاتورة" className="rounded-lg border border-line bg-card shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-extrabold">
            الفاتورة الحالية <span className="text-sm font-bold text-ink-3">({cartCount(cart)} قطعة)</span>
          </h2>
          {cart.length > 0 && (
            <button type="button" onClick={clearCart} className="text-sm font-bold text-neg underline underline-offset-4">
              إفراغ الفاتورة
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon="barcode"
              title="امسح أول منتج"
              description="وجّه الماسح نحو باركود المنتج ليُضاف إلى الفاتورة تلقائيًا."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {cart.map((line) => {
              const onHand = stockOf(line.productId);
              const atMax = line.qty >= onHand;
              return (
                <li key={line.productId} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-40 flex-1">
                    <p className="font-bold">{line.name}</p>
                    <p dir="ltr" className="mt-0.5 text-start font-mono text-xs text-ink-3">
                      {line.barcode} · {formatEgp(line.pricePiastres)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1" aria-label={`كمية ${line.name}`}>
                    <button
                      type="button"
                      className="grid size-9 place-items-center rounded-md border border-line text-ink-2 hover:bg-page disabled:opacity-40"
                      onClick={() => setCart((c) => setLineQty(c, line.productId, line.qty - 1, onHand))}
                      aria-label="إنقاص الكمية"
                    >
                      <Icon name="arrowDown" size={14} />
                    </button>
                    <span className="bidi w-10 text-center font-extrabold">{line.qty}</span>
                    <button
                      type="button"
                      disabled={atMax}
                      title={atMax ? `المتبقي فقط ${onHand}` : "زيادة الكمية"}
                      className="grid size-9 place-items-center rounded-md border border-line text-ink-2 hover:bg-page disabled:opacity-40"
                      onClick={() => setCart((c) => setLineQty(c, line.productId, line.qty + 1, onHand))}
                      aria-label="زيادة الكمية"
                    >
                      <Icon name="plus" size={14} />
                    </button>
                  </div>

                  <span className="bidi w-24 text-end font-extrabold">{formatEgp(line.pricePiastres * line.qty)}</span>

                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-md text-neg hover:bg-neg-bg"
                    onClick={() => setCart((c) => removeLine(c, line.productId))}
                    aria-label={`إزالة ${line.name}`}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Payment + save */}
      <section aria-label="الدفع والحفظ" className="rounded-lg border border-line bg-card p-4 shadow-card">
        <div className="mb-4 max-w-sm">
          <Field label="قيمة الخصم بالجنيه (اختياري)" htmlFor="discount-amount" error={discountInputError} hint="اتركها فارغة بدون خصم">
            <input
              id="discount-amount"
              type="text"
              inputMode="decimal"
              value={discountAmount}
              onChange={(event) => {
                setDiscountAmount(event.target.value);
                setDiscountError(undefined);
              }}
              placeholder="مثال: 25"
              className={inputCls}
            />
          </Field>
        </div>

        <div>
          <span className="mb-2 block text-sm font-bold text-ink-2" id="pay-method-label">
            طريقة الدفع
          </span>
          <div role="radiogroup" aria-labelledby="pay-method-label" className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => setMethod(m)}
                className={`flex h-12 items-center justify-center gap-2 rounded-md border-2 text-sm font-bold transition-colors ${
                  method === m
                    ? m === "cash"
                      ? "border-cash bg-cash-bg text-cash"
                      : "border-brand bg-brand/8 text-brand"
                    : "border-line bg-card text-ink-2 hover:bg-page"
                }`}
              >
                <Icon name={m === "cash" ? "wallet" : "phone"} size={18} />
                {PAYMENT_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {discountPiastres > 0 && (
            <>
              <div className="flex items-center justify-between gap-3 text-sm text-ink-2">
                <span>قبل الخصم</span>
                <span className="bidi">{formatEgp(subtotalPiastres)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm font-bold text-pos">
                <span>
                  الخصم
                </span>
                <span className="bidi">−{formatEgp(discountPiastres)}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-ink-2">الإجمالي المستحق</span>
            <span className="bidi text-2xl font-extrabold text-brand">{formatEgp(finalTotalPiastres)}</span>
          </div>
        </div>

        <Button type="button" variant="primary" className="mt-4 w-full" loading={saving} disabled={cart.length === 0} onClick={submit}>
          <Icon name="receipt" size={16} />
          حفظ الفاتورة
        </Button>
        <p className="mt-2 text-center text-[11px] text-ink-3">
          فواتير المتجر لا تُحتسب في حسابات فيودافون كاش — قسم مستقل.
        </p>
      </section>
    </div>
  );
}
