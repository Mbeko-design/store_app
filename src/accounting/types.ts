/** Piastres integer — 1 EGP = 100 piastres (re-exported for accounting consumers). */
export type { Piastres } from "../utils/money";

export type OperationType = "withdraw" | "deposit" | "cash";

export const OPERATION_TYPES: readonly OperationType[] = ["withdraw", "deposit", "cash"] as const;

/**
 * Deficit meter status:
 *  - "deficit"  (عجز)   → difference < 0
 *  - "surplus"  (زيادة) → difference > 0
 *  - "balanced" (تمام)  → difference === 0
 */
export type DeficitStatus = "deficit" | "surplus" | "balanced";

/** Stable pseudo-account id representing the physical cash source "(Cash) فلوس". */
export const CASH_ACCOUNT_ID = "cash";

export interface Account {
  id: string;
  phone: string;
  label?: string;
  /** Configurable monthly withdrawal limit (default 40,000 EGP). */
  limitMonthlyPiastres: number;
  /** Manually entered opening balance — editable later; derived balance = opening + operations. */
  openingBalancePiastres: number;
  createdAtIso: string;
  /** Non-null when archived (hidden from default lists, restorable). */
  archivedAtIso: string | null;
}

export interface Operation {
  id: string;
  /** Stable account id (never a phone number); CASH_ACCOUNT_ID for "(Cash) فلوس". */
  accountId: string;
  type: OperationType;
  amountPiastres: number;
  /** UTC ISO timestamp of when the operation happened (stored UTC, displayed local). */
  occurredAtIso: string;
  note?: string;
  createdAtIso: string;
}
