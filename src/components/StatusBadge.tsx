import { Icon, type IconName } from "./Icon";

export type BadgeTone = "pos" | "neg" | "cash" | "neutral" | "archived";

const TONES: Record<BadgeTone, string> = {
  pos: "bg-pos-bg text-pos border-pos-line",
  neg: "bg-neg-bg text-neg border-neg-line",
  cash: "bg-cash-bg text-cash border-cash-line",
  neutral: "bg-page text-ink-2 border-line",
  archived: "bg-page text-ink-3 border-line",
};

const ICONS: Record<BadgeTone, IconName> = {
  pos: "checkCircle",
  neg: "alert",
  cash: "info",
  neutral: "check",
  archived: "archive",
};

/** Status chip — ALWAYS icon + text, never color alone (WCAG). */
export function StatusBadge({ tone, label, title }: { tone: BadgeTone; label: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${TONES[tone]}`}>
      <Icon name={ICONS[tone]} size={14} />
      {label}
    </span>
  );
}
