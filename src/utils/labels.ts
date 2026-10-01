import type { OperationType } from "../accounting/types";

export function newId(): string {
  return crypto.randomUUID();
}

/** Arabic labels for operation types — single source for the whole UI. */
export const TYPE_LABEL: Record<OperationType, string> = {
  withdraw: "سحب",
  deposit: "إيداع",
  cash: "فلوس",
};

/** Semantic color classes per type (green/blue/red — never brand use). */
export const TYPE_STYLE: Record<OperationType, { text: string; dot: string; chip: string }> = {
  withdraw: { text: "text-neg", dot: "bg-neg", chip: "bg-neg-bg text-neg" },
  deposit: { text: "text-pos", dot: "bg-pos", chip: "bg-pos-bg text-pos" },
  cash: { text: "text-cash", dot: "bg-cash", chip: "bg-cash-bg text-cash" },
};

export const CASH_SOURCE_LABEL = "(Cash) فلوس";
