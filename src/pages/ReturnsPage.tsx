import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { BarcodeInput } from "../components/BarcodeInput";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { PaymentBadge } from "../components/ShopBadges";
import { LoadingBlock, SkeletonList } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useLoading } from "../hooks/useData";
import { useShopView } from "../hooks/useShop";
import { PAYMENT_LABEL, returnableQuantity, returnsInRange, todayRange, type PaymentMethod, type Product, type SaleReturn } from "../shop";
import { saveReturn } from "../services/returnsService";
import { localMonthRange } from "../utils/dates";
import { formatDateTime, formatEgp } from "../utils/format";

type Period = "today" | "month" | "custom" | "all";
type MethodFilter = "all" | PaymentMethod;
type DraftLine = { product: Product; qty: number };

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "today", label: "اليوم" },
  { id: "month", label: "هذا الشهر" },
  { id: "custom", label: "فترة محددة" },
  { id: "all", label: "الكل" },
];
const METHODS: Array<{ id: MethodFilter; label: string }> = [
  { id: "all", label: "كل الطرق" },
  { id: "cash", label: "نقدًا" },
  { id: "vodafone", label: "فودافون كاش" },
];

function dateInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function filteredByPeriod(records: SaleReturn[], period: Period, fromDate: string, toDate: string): SaleReturn[] {
  if (period === "today") {
    const { start, end } = todayRange();
    return returnsInRange(records, start, end);
  }
  if (period === "month") {
    const { start, end } = localMonthRange();
    return returnsInRange(records, start, end);
  }
  if (period !== "custom") return records;
  if (fromDate && toDate && fromDate > toDate) return [];
  const start = fromDate ? new Date(`${fromDate}T00:00:00`) : undefined;
  const end = toDate ? new Date(`${toDate}T00:00:00`) : undefined;
  if (end) end.setDate(end.getDate() + 1);
  return records.filter((record) => {
    const time = Date.parse(record.createdAtIso);
    return (!start || time >= start.getTime()) && (!end || time < end.getTime());
  });
}

export function ReturnsPage() {
  const view = useShopView();
  const loading = useLoading(view);
  const toast = useToast();
  const scanRef = useRef<HTMLInputElement>(null);
  const [period, setPeriod] = useState<Period>("today");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [fromDate, setFromDate] = useState(() => dateInputValue(new Date()));
  const [toDate, setToDate] = useState(() => dateInputValue(new Date()));
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);

  const remainingFor = (productId: string) =>
    returnableQuantity(productId, view?.receipts ?? [], view?.returns ?? []);

  const searchResults = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value || !view) return [];
    return view.products
      .filter((product) =>
        (product.name.toLocaleLowerCase().includes(value) || product.barcode.toLocaleLowerCase().startsWith(value)) &&
        remainingFor(product.id) > (draft.find((line) => line.product.id === product.id)?.qty ?? 0),
      )
      .slice(0, 8);
  }, [query, view, draft]);

  const visibleReturns = useMemo(() => {
    if (!view) return [];
    const filtered = filteredByPeriod(view.returns, period, fromDate, toDate);
    return methodFilter === "all" ? filtered : filtered.filter((record) => record.paymentMethod === methodFilter);
  }, [view, period, fromDate, toDate, methodFilter]);

  const total = draft.reduce((sum, line) => sum + line.product.pricePiastres * line.qty, 0);
  const chipCls = (active: boolean) =>
    `h-9 rounded-md px-4 text-sm font-bold transition-colors ${active ? "bg-brand text-white" : "text-ink-2 hover:bg-page"}`;

  const addProduct = (product: Product) => {
    setError(undefined);
    const currentQty = draft.find((line) => line.product.id === product.id)?.qty ?? 0;
    if (currentQty >= remainingFor(product.id)) {
      setError(`لا يمكن إرجاع كمية أكبر من المباعة للصنف «${product.name}»`);
      return;
    }
    const existing = draft.find((line) => line.product.id === product.id);
    setDraft(existing
      ? draft.map((line) => line.product.id === product.id ? { ...line, qty: line.qty + 1 } : line)
      : [...draft, { product, qty: 1 }]);
    setQuery("");
    requestAnimationFrame(() => scanRef.current?.focus());
  };

  const onScan = (value: string) => {
    const normalized = value.trim().toLocaleLowerCase();
    const exact = view?.products.find((product) => product.barcode.toLocaleLowerCase() === normalized);
    if (exact) {
      addProduct(exact);
      return;
    }
    const exactName = searchResults.find((product) => product.name.toLocaleLowerCase() === normalized);
    if (exactName) {
      addProduct(exactName);
      return;
    }
    if (!searchResults.length) setError("لا يوجد صنف قابل للإرجاع بهذا الاسم أو الباركود");
  };

  const updateQty = (product: Product, raw: string) => {
    const qty = Number(raw);
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > remainingFor(product.id)) {
      setError(`الكمية يجب أن تكون من 1 إلى ${remainingFor(product.id)} للصنف «${product.name}»`);
      return;
    }
    setError(undefined);
    setDraft((current) => current.map((line) => line.product.id === product.id ? { ...line, qty } : line));
  };

  const submit = async () => {
    if (saving || draft.length === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      const record = await saveReturn({
        lines: draft.map(({ product, qty }) => ({ productId: product.id, qty })),
        paymentMethod: method,
      });
      setDraft([]);
      toast.success(`تم تسجيل المرتجع رقم ${record.number} بإجمالي ${formatEgp(record.totalPiastres)}`);
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "";
      if (code === "return_qty_exceeded") {
        setError("الكمية المرتجعة تجاوزت الكمية المباعة بعد احتساب المرتجعات السابقة. راجع الكمية وحاول مجددًا.");
      } else if (code === "product_missing") {
        setError("أحد المنتجات لم يعد موجودًا. حدّث الصفحة ثم حاول مجددًا.");
      } else {
        toast.error("تعذر حفظ المرتجع");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-4"><LoadingBlock label="جارٍ تحميل المرتجعات…" /><SkeletonList rows={5} /></div>;
  }
  if (!view) return null;

  return (
    <div className="space-y-5">
      <nav aria-label="المبيعات والمرتجعات" className="flex gap-2 border-b border-line">
        <Link to="/shop/sales" className="px-4 py-3 text-sm font-bold text-ink-2 hover:text-brand">المبيعات</Link>
        <Link to="/shop/returns" aria-current="page" className="border-b-2 border-brand px-4 py-3 text-sm font-extrabold text-brand">المرتجعات</Link>
      </nav>

      <section aria-labelledby="return-entry-heading" className="space-y-4 rounded-lg border border-line bg-card p-4 shadow-card">
        <div>
          <h2 id="return-entry-heading" className="text-lg font-extrabold">تسجيل مرتجع</h2>
          <p className="mt-1 text-sm text-ink-3">ابحث بالاسم أو امسح الباركود. يُستخدم سعر المنتج الحالي ويُعاد الصنف للمخزون.</p>
        </div>
        <BarcodeInput
          id="return-product"
          value={query}
          onValueChange={(value) => { setQuery(value); setError(undefined); }}
          onScan={onScan}
          clearOnScan={false}
          inputRef={scanRef}
          autoFocus
          label="المنتج"
          placeholder="امسح الباركود أو ابحث بالاسم/أول أرقام الباركود…"
          error={error}
        />
        {searchResults.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line" aria-label="نتائج المنتجات القابلة للإرجاع">
            {searchResults.map((product) => (
              <li key={product.id}>
                <button type="button" onClick={() => addProduct(product)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-start hover:bg-page">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{product.name}</span>
                    <span dir="ltr" className="block text-start font-mono text-xs text-ink-3">{product.barcode}</span>
                  </span>
                  <span className="text-end text-xs text-ink-2">
                    <span className="block">متبقي للإرجاع: {remainingFor(product.id)}</span>
                    <span className="bidi">{formatEgp(product.pricePiastres)} للقطعة</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {draft.length > 0 && (
          <div className="overflow-hidden rounded-md border border-line">
            <ul className="divide-y divide-line">
              {draft.map(({ product, qty }) => (
                <li key={product.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{product.name}</p>
                    <p className="bidi text-xs text-ink-3">{formatEgp(product.pricePiastres)} للقطعة · متاح إرجاع {remainingFor(product.id)}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold">
                    الكمية
                    <input
                      type="number"
                      min={1}
                      max={remainingFor(product.id)}
                      value={qty}
                      onChange={(event) => updateQty(product, event.target.value)}
                      className="h-10 w-20 rounded border border-line px-2 text-center"
                      aria-label={`كمية إرجاع ${product.name}`}
                    />
                  </label>
                  <span className="bidi font-extrabold">{formatEgp(product.pricePiastres * qty)}</span>
                  <button type="button" onClick={() => setDraft((items) => items.filter((line) => line.product.id !== product.id))} className="text-sm font-bold text-neg">حذف</button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-page p-3">
              <span className="font-bold">طريقة رد المبلغ</span>
              <div role="group" aria-label="طريقة رد المبلغ" className="flex gap-2">
                {(["cash", "vodafone"] as const).map((option) => (
                  <button key={option} type="button" aria-pressed={method === option} onClick={() => setMethod(option)} className={chipCls(method === option)}>
                    {PAYMENT_LABEL[option]}
                  </button>
                ))}
              </div>
              <span className="bidi text-lg font-extrabold text-neg">إجمالي المرتجع: {formatEgp(total)}</span>
            </div>
          </div>
        )}
        <Button type="button" onClick={submit} loading={saving} disabled={!draft.length}>
          <Icon name="receipt" size={16} />
          تأكيد المرتجع
        </Button>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="فترة المرتجعات" className="flex rounded-md border border-line bg-card p-1">
          {PERIODS.map((item) => (
            <button key={item.id} type="button" aria-pressed={period === item.id} onClick={() => setPeriod(item.id)} className={chipCls(period === item.id)}>{item.label}</button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-card p-2 text-sm">
            <label htmlFor="returns-from" className="font-bold">من</label>
            <input id="returns-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-9 rounded border border-line px-2" dir="ltr" />
            <label htmlFor="returns-to" className="font-bold">إلى</label>
            <input id="returns-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-9 rounded border border-line px-2" dir="ltr" />
          </div>
        )}
        <div role="group" aria-label="طريقة رد المبلغ" className="flex rounded-md border border-line bg-card p-1">
          {METHODS.map((item) => (
            <button key={item.id} type="button" aria-pressed={methodFilter === item.id} onClick={() => setMethodFilter(item.id)} className={chipCls(methodFilter === item.id)}>{item.label}</button>
          ))}
        </div>
      </div>

      <section aria-labelledby="return-history-heading">
        <h2 id="return-history-heading" className="mb-3 text-lg font-extrabold">سجل المرتجعات <span className="text-sm font-bold text-ink-3">({visibleReturns.length})</span></h2>
        {visibleReturns.length === 0 ? (
          <EmptyState icon="receipt" title="لا توجد مرتجعات في هذه التصفية" description="سجّل مرتجعًا أو جرّب فترة أو طريقة رد أخرى." />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-card">
            {visibleReturns.map((record) => (
              <li key={record.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">مرتجع <span className="bidi">#{record.number}</span></p>
                    <p className="text-xs text-ink-3">{formatDateTime(record.createdAtIso)}</p>
                  </div>
                  <PaymentBadge method={record.paymentMethod} />
                  <span className="bidi font-extrabold text-neg">−{formatEgp(record.totalPiastres)}</span>
                </div>
                <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                  {record.lines.map((line) => (
                    <li key={line.productId} className="flex justify-between gap-3">
                      <span>{line.name} × {line.qty}</span>
                      <span className="bidi text-ink-2">{formatEgp(line.pricePiastres * line.qty)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
