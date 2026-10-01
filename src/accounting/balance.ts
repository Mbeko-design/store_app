import { type Account, type Operation } from "./types";
import { totalsByType } from "./totals";

/**
 * Account (wallet) balance.
 *
 *   balance = openingBalance + deposits − withdrawals
 *
 * Notes:
 *  - The opening balance is a manually entered, EDITABLE input; changing it
 *    immediately shifts the derived balance (history is never rewritten).
 *  - cash (فلوس) operations do NOT change a Vodafone wallet balance. They are
 *    cash-side inflows and are counted only in the deficit meter. (Documented
 *    assumption — see README.)
 *  - `ops` is expected to be the FULL operation list; filtering by accountId
 *    happens inside so callers can pass one shared array for every account
 *    without risk of cross-account contamination or double-counting.
 */
export function accountBalance(account: Pick<Account, "id" | "openingBalancePiastres">, ops: readonly Operation[]): number {
  const own = ops.filter((o) => o.accountId === account.id);
  const totals = totalsByType(own);
  return account.openingBalancePiastres + totals.deposit - totals.withdraw;
}

/** Balance given already-filtered, account-owned operations (used for single-account views). */
export function balanceFromAccountOps(openingBalancePiastres: number, ownOps: readonly Operation[]): number {
  const totals = totalsByType(ownOps);
  return openingBalancePiastres + totals.deposit - totals.withdraw;
}
