import { totalsByType, type CategoryTotals } from "./totals";
import type { DeficitStatus, Operation } from "./types";

/**
 * مقياس العجز — the deficit meter.
 *
 * Rule (agreed with the product owner, see README "Accounting model"):
 *
 *   Difference = (Total Reconciliation Inflows) − (Total Reconciliation Outflows)
 *   Inflows  = فلوس (cash) + إيداع (deposits)
 *   Outflows = سحب (withdrawals)
 *
 *   difference < 0 → عجز  (deficit)
 *   difference > 0 → زيادة (surplus)
 *   difference = 0 → تمام  (balanced)
 *
 * This is the ONLY place the meter is computed. UI never contains this formula.
 */
export interface DeficitResult {
  inflowsPiastres: number;
  outflowsPiastres: number;
  differencePiastres: number;
  status: DeficitStatus;
}

export function computeDeficit(totals: CategoryTotals): DeficitResult {
  const inflows = totals.cash + totals.deposit;
  const outflows = totals.withdraw;
  const difference = inflows - outflows;
  const status: DeficitStatus = difference < 0 ? "deficit" : difference > 0 ? "surplus" : "balanced";
  return {
    inflowsPiastres: inflows,
    outflowsPiastres: outflows,
    differencePiastres: difference,
    status,
  };
}

/** Convenience: compute the meter directly from a list of operations. */
export function computeDeficitFromOps(ops: readonly Operation[]): DeficitResult {
  return computeDeficit(totalsByType(ops));
}
