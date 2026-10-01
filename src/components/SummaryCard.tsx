import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type SummaryTone = "pos" | "cash" | "neg" | "navy";

const TONE: Record<SummaryTone, { chip: string; amount: string }> = {
  pos: { chip: "bg-pos-bg text-pos", amount: "text-pos" },
  cash: { chip: "bg-cash-bg text-cash", amount: "text-cash" },
  neg: { chip: "bg-neg-bg text-neg", amount: "text-neg" },
  navy: { chip: "bg-navy/8 text-navy", amount: "text-ink" },
};

/**
 * Dashboard summary card: label + big amount (+ optional sub).
 * Receives an already-formatted amount string — no math here.
 */
export function SummaryCard({
  label,
  amount,
  tone,
  icon,
  sub,
  footer,
}: {
  label: string;
  amount: string;
  tone: SummaryTone;
  icon: IconName;
  sub?: string;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className={`grid size-8 place-items-center rounded-md ${TONE[tone].chip}`}>
          <Icon name={icon} size={16} />
        </span>
        <h3 className="text-sm font-bold text-ink-2">{label}</h3>
      </div>
      <p className={`mt-2 text-2xl font-extrabold ${TONE[tone].amount}`}>
        <span className="bidi">{amount}</span>
      </p>
      {sub && <p className="mt-1 text-xs text-ink-3">{sub}</p>}
      {footer}
    </div>
  );
}
