import type { Operation, OperationType } from "./types";

/**
 * Totals per operation category, in piastres.
 * Every operation is counted exactly once, under its own type.
 */
export interface CategoryTotals {
  withdraw: number;
  deposit: number;
  cash: number;
}

export function emptyTotals(): CategoryTotals {
  return { withdraw: 0, deposit: 0, cash: 0 };
}

/**
 * Sum a list of operations by type.
 * Each operation contributes to exactly one bucket → no double-counting by construction.
 */
export function totalsByType(ops: readonly Operation[]): CategoryTotals {
  const t = emptyTotals();
  for (const op of ops) {
    t[op.type] += op.amountPiastres;
  }
  return t;
}

/** Totals restricted to one account (account-level figures — NOT global totals). */
export function totalsForAccount(ops: readonly Operation[], accountId: string): CategoryTotals {
  return totalsByType(ops.filter((o) => o.accountId === accountId));
}

/** Total of a single category across a list of operations. */
export function totalOfType(ops: readonly Operation[], type: OperationType): number {
  return totalsByType(ops)[type];
}

/** Sum of all three categories (used for display centers/legends — still accounting-owned). */
export function grandTotal(t: CategoryTotals): number {
  return t.withdraw + t.deposit + t.cash;
}
