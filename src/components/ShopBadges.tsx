import { PAYMENT_LABEL, type PaymentMethod, type StockStatus } from "../shop/types";
import { Icon, type IconName } from "./Icon";

/** Status is always icon + word (never color alone) — shared shop badges. */

const STOCK_BADGE: Record<StockStatus, { cls: string; icon: IconName; label: string }> = {
  out: { cls: "bg-neg-bg text-neg border-neg-line", icon: "alert", label: "نفد" },
  low: { cls: "bg-warn-bg text-warn border-warn-line", icon: "alert", label: "منخفض" },
  ok: { cls: "bg-pos-bg text-pos border-pos-line", icon: "checkCircle", label: "متوفر" },
};

export function StockBadge({ status }: { status: StockStatus }) {
  const b = STOCK_BADGE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${b.cls}`}>
      <Icon name={b.icon} size={13} />
      {b.label}
    </span>
  );
}

const PAY_BADGE: Record<PaymentMethod, { cls: string; icon: IconName }> = {
  cash: { cls: "bg-cash-bg text-cash border-cash-line", icon: "wallet" },
  vodafone: { cls: "bg-navy/8 text-navy border-navy/20", icon: "phone" },
};

export function PaymentBadge({ method }: { method: PaymentMethod }) {
  const b = PAY_BADGE[method];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${b.cls}`}>
      <Icon name={b.icon} size={13} />
      {PAYMENT_LABEL[method]}
    </span>
  );
}
