import type { Piastres } from "./money.js";
import type { WalletId } from "./accounts.js";
import { CASH_ACCOUNT, FEES_INCOME_ACCOUNT, walletAccountOf } from "./accounts.js";
import type { EntryKind, JournalEntry } from "./ledger.js";
import { newId, nowIso, validateEntry } from "./ledger.js";

export interface WalletOp {
  wallet: WalletId;
  /** Value moved through the wallet, in piastres. */
  amount: Piastres;
  /** Our charge on this operation, in piastres (default 0). */
  fee?: Piastres;
  customer?: string;
  phone?: string;
  note?: string;
  ref?: string;
  deviceId: string;
  occurredAt?: string;
}

function baseMeta(op: WalletOp, extra: Partial<JournalEntry["meta"]>): JournalEntry["meta"] {
  return {
    wallet: op.wallet,
    amount: op.amount,
    fee: op.fee ?? 0,
    customer: op.customer?.trim() || undefined,
    phone: op.phone?.trim() || undefined,
    note: op.note?.trim() || undefined,
    ref: op.ref?.trim() || undefined,
    ...extra,
  };
}

function assertOp(op: WalletOp): void {
  if (!Number.isInteger(op.amount) || op.amount <= 0) throw new Error("amount_must_be_positive");
  const fee = op.fee ?? 0;
  if (!Number.isInteger(fee) || fee < 0) throw new Error("fee_invalid");
  if (!op.deviceId) throw new Error("missing_device");
}

/**
 * SEND: customer hands us cash (amount + fee); we push `amount` from our
 * float to their wallet number.
 *   Dr cash (amount+fee) / Cr wallet float (amount) / Cr fee income (fee)
 */
export function buildWalletSend(op: WalletOp): JournalEntry {
  assertOp(op);
  const fee = op.fee ?? 0;
  const cashIn = op.amount + fee;
  const entry: JournalEntry = {
    id: newId(),
    kind: "wallet_send",
    occurredAt: op.occurredAt ?? nowIso(),
    deviceId: op.deviceId,
    postings: [
      { accountId: CASH_ACCOUNT, debit: cashIn, credit: 0 },
      { accountId: walletAccountOf(op.wallet), debit: 0, credit: op.amount },
      ...(fee > 0 ? [{ accountId: FEES_INCOME_ACCOUNT, debit: 0, credit: fee }] : []),
    ],
    meta: baseMeta(op, { cashDelta: cashIn, walletDelta: -op.amount }),
    createdAt: nowIso(),
  };
  validateEntry(entry);
  return entry;
}

/**
 * RECEIVE: their wallet sends `amount` to our number; we hand the customer
 * cash (amount − fee) and keep the fee.
 *   Dr wallet float (amount) / Cr cash (amount−fee) / Cr fee income (fee)
 */
export function buildWalletReceive(op: WalletOp): JournalEntry {
  assertOp(op);
  const fee = op.fee ?? 0;
  if (fee > op.amount) throw new Error("fee_exceeds_amount");
  const cashOut = op.amount - fee;
  const entry: JournalEntry = {
    id: newId(),
    kind: "wallet_receive",
    occurredAt: op.occurredAt ?? nowIso(),
    deviceId: op.deviceId,
    postings: [
      { accountId: walletAccountOf(op.wallet), debit: op.amount, credit: 0 },
      ...(cashOut > 0 ? [{ accountId: CASH_ACCOUNT, debit: 0, credit: cashOut }] : []),
      ...(fee > 0 ? [{ accountId: FEES_INCOME_ACCOUNT, debit: 0, credit: fee }] : []),
    ],
    meta: baseMeta(op, { cashDelta: -cashOut, walletDelta: op.amount }),
    createdAt: nowIso(),
  };
  validateEntry(entry);
  return entry;
}

/** DEPOSIT: move our own cash into our own float (top-up). No fee. */
export function buildWalletDeposit(op: WalletOp): JournalEntry {
  assertOp(op);
  const entry: JournalEntry = {
    id: newId(),
    kind: "wallet_deposit",
    occurredAt: op.occurredAt ?? nowIso(),
    deviceId: op.deviceId,
    postings: [
      { accountId: walletAccountOf(op.wallet), debit: op.amount, credit: 0 },
      { accountId: CASH_ACCOUNT, debit: 0, credit: op.amount },
    ],
    meta: baseMeta(op, { fee: 0, cashDelta: -op.amount, walletDelta: op.amount }),
    createdAt: nowIso(),
  };
  validateEntry(entry);
  return entry;
}

/** WITHDRAW: pull from our own float back into cash. No fee. */
export function buildWalletWithdraw(op: WalletOp): JournalEntry {
  assertOp(op);
  const entry: JournalEntry = {
    id: newId(),
    kind: "wallet_withdraw",
    occurredAt: op.occurredAt ?? nowIso(),
    deviceId: op.deviceId,
    postings: [
      { accountId: CASH_ACCOUNT, debit: op.amount, credit: 0 },
      { accountId: walletAccountOf(op.wallet), debit: 0, credit: op.amount },
    ],
    meta: baseMeta(op, { fee: 0, cashDelta: op.amount, walletDelta: -op.amount }),
    createdAt: nowIso(),
  };
  validateEntry(entry);
  return entry;
}

export type WalletOpBuilder = (op: WalletOp) => JournalEntry;

/** Builders for the four wallet movements (fee-aware). */
export const WALLET_BUILDERS: Record<"wallet_send" | "wallet_receive" | "wallet_deposit" | "wallet_withdraw", WalletOpBuilder> = {
  wallet_send: buildWalletSend,
  wallet_receive: buildWalletReceive,
  wallet_deposit: buildWalletDeposit,
  wallet_withdraw: buildWalletWithdraw,
};

/**
 * OPENING: funds an asset account (cash or a wallet float) from equity.
 * Used to enter the store's starting balances — and for owner capital
 * adjustments. Never touches income.
 */
export function buildOpening(op: {
  /** Target asset account (cash drawer or a wallet float). */
  accountId: string;
  amount: Piastres;
  note?: string;
  deviceId: string;
  occurredAt?: string;
}): JournalEntry {
  if (!op.accountId) throw new Error("missing_account");
  if (!Number.isInteger(op.amount) || op.amount <= 0) throw new Error("amount_must_be_positive");
  if (!op.deviceId) throw new Error("missing_device");
  const at = op.occurredAt ?? nowIso();
  const entry: JournalEntry = {
    id: newId(),
    kind: "opening",
    occurredAt: at,
    deviceId: op.deviceId,
    postings: [
      { accountId: op.accountId, debit: op.amount, credit: 0 },
      { accountId: "opening_balance", debit: 0, credit: op.amount },
    ],
    meta: { amount: op.amount, note: op.note?.trim() || undefined, cashDelta: undefined, walletDelta: undefined },
    createdAt: at,
  };
  validateEntry(entry);
  return entry;
}

/** Normalized input for any operation the UI can record. */
export interface OperationInput {
  kind: "wallet_send" | "wallet_receive" | "wallet_deposit" | "wallet_withdraw" | "opening";
  wallet?: WalletId;
  /** Target account for `opening` (cash drawer or wallet float). */
  accountId?: string;
  amount: Piastres;
  fee?: Piastres;
  customer?: string;
  phone?: string;
  note?: string;
  ref?: string;
  deviceId: string;
  occurredAt?: string;
}

/** Single entry point used by the UI: dispatches to the right builder. */
export function buildOperation(input: OperationInput): JournalEntry {
  if (input.kind === "opening") {
    if (!input.accountId) throw new Error("missing_account");
    return buildOpening({
      accountId: input.accountId,
      amount: input.amount,
      note: input.note,
      deviceId: input.deviceId,
      occurredAt: input.occurredAt,
    });
  }
  if (!input.wallet) throw new Error("missing_wallet");
  return WALLET_BUILDERS[input.kind]({
    wallet: input.wallet,
    amount: input.amount,
    fee: input.fee,
    customer: input.customer,
    phone: input.phone,
    note: input.note,
    ref: input.ref,
    deviceId: input.deviceId,
    occurredAt: input.occurredAt,
  });
}

/**
 * What the wallet float becomes after an operation — used by the UI to warn
 * before an operation would drive a float negative.
 */
export function walletAfter(kind: EntryKind, currentFloat: Piastres, amount: Piastres, fee = 0): Piastres {
  switch (kind) {
    case "wallet_send":
    case "wallet_withdraw":
      return currentFloat - amount;
    case "wallet_receive":
    case "wallet_deposit":
      return currentFloat + amount;
    case "reversal":
      return currentFloat;
    default:
      return currentFloat;
  }
}

/** Cash the customer hands over on a send (amount + fee). */
export function cashInForSend(amount: Piastres, fee: Piastres): Piastres {
  return amount + fee;
}

/** Cash we hand the customer on a receive (amount − fee). */
export function cashOutForReceive(amount: Piastres, fee: Piastres): Piastres {
  return amount - fee;
}
