import { isWithin, localMonthRange } from "../utils/dates";
import type { Account, Operation } from "./types";

/** Default monthly withdrawal limit when creating an account: 40,000 EGP. */
export const DEFAULT_MONTHLY_LIMIT_PIASTRES = 4_000_000;

/**
 * Remaining monthly limit.
 *
 *   remaining = monthlyLimit − Σ (withdrawals on this account in the current local calendar month)
 *
 * The window resets monthly. `remainingPiastres` may go negative (over limit);
 * `exceeds` exposes that state so the UI can show it with icon + text.
 */
export interface LimitStatus {
  limitPiastres: number;
  usedPiastres: number;
  remainingPiastres: number;
  exceeds: boolean;
  windowStartIso: string;
  windowEndIso: string;
}

export function remainingLimit(account: Account, ops: readonly Operation[], now: Date = new Date()): LimitStatus {
  const { start, end } = localMonthRange(now);
  let used = 0;
  for (const op of ops) {
    if (op.accountId !== account.id) continue;
    if (op.type !== "withdraw") continue;
    if (isWithin(op.occurredAtIso, start, end)) used += op.amountPiastres;
  }
  const remaining = account.limitMonthlyPiastres - used;
  return {
    limitPiastres: account.limitMonthlyPiastres,
    usedPiastres: used,
    remainingPiastres: remaining,
    exceeds: remaining < 0,
    windowStartIso: start.toISOString(),
    windowEndIso: end.toISOString(),
  };
}
