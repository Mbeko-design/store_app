import { Link } from "react-router";
import type { DeficitResult } from "../accounting/deficit";
import type { DeficitStatus } from "../accounting/types";
import { formatEgp } from "../utils/format";
import { Icon, type IconName } from "./Icon";
import type { BadgeTone } from "./StatusBadge";

/** Status metadata — icon + word + color, so status never relies on color alone. */
export const STATUS_META: Record<DeficitStatus, { label: string; tone: BadgeTone; icon: IconName; textCls: string }> = {
  deficit: { label: "عجز", tone: "neg", icon: "alert", textCls: "text-neg" },
  surplus: { label: "زيادة", tone: "pos", icon: "arrowUp", textCls: "text-pos" },
  balanced: { label: "تمام", tone: "pos", icon: "checkCircle", textCls: "text-pos" },
};

/**
 * مقياس العجز — the large meter card for the dashboard.
 * Rule (implemented in accounting/deficit.ts): Difference = (فلوس + إيداع) − سحب.
 */
export function DeficitMeter({ result, compact = false }: { result: DeficitResult; compact?: boolean }) {
  const meta = STATUS_META[result.status];
  const sign = result.differencePiastres < 0 ? "−" : result.differencePiastres > 0 ? "+" : "";

  return (
    <section className="rounded-lg border border-line bg-card p-4 shadow-card" aria-label="مقياس العجز">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`grid size-8 place-items-center rounded-md ${result.status === "deficit" ? "bg-neg-bg text-neg" : "bg-pos-bg text-pos"}`}>
            <Icon name={meta.icon} size={16} />
          </span>
          <h3 className="text-sm font-bold text-ink-2">مقياس العجز</h3>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold ${
            result.status === "deficit" ? "border-neg-line bg-neg-bg text-neg" : "border-pos-line bg-pos-bg text-pos"
          }`}
        >
          <Icon name={meta.icon} size={14} />
          {meta.label}
        </span>
      </div>

      <p className={`mt-3 ${compact ? "text-2xl" : "text-3xl"} font-extrabold ${meta.textCls}`}>
        <span className="bidi">
          {sign}
          {formatEgp(Math.abs(result.differencePiastres))}
        </span>
      </p>
      <p className="mt-1 text-xs text-ink-3">
        النتيجة = (إجمالي الوارد: فلوس + إيداع) − (إجمالي الصادر: سحب)
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-center">
        <div>
          <p className="text-[11px] font-bold text-ink-3">إجمالي الوارد</p>
          <p className="text-sm font-extrabold text-pos">
            <span className="bidi">{formatEgp(result.inflowsPiastres)}</span>
          </p>
        </div>
        <div className="border-s border-line">
          <p className="text-[11px] font-bold text-ink-3">إجمالي الصادر</p>
          <p className="text-sm font-extrabold text-neg">
            <span className="bidi">{formatEgp(result.outflowsPiastres)}</span>
          </p>
        </div>
      </div>

      <Link to="/deficit" className="mt-3 flex h-10 items-center justify-center gap-1 rounded-md border border-line text-sm font-bold text-navy hover:bg-page">
        عرض تفاصيل المقياس
        <Icon name="chevronLeft" size={16} />
      </Link>
    </section>
  );
}
