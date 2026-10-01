import type { Piastres } from "./money.js";
import { assertIntegerPiastres } from "./money.js";
import type { Account, AccountType, WalletId } from "./accounts.js";
import { applySign } from "./accounts.js";

export interface Posting {
  accountId: string;
  debit: Piastres;
  credit: Piastres;
}

export type EntryKind =
  | "wallet_send" // customer cash → send from our wallet float
  | "wallet_receive" // wallet inflow → we hand out cash
  | "wallet_deposit" // our cash → into our float
  | "wallet_withdraw" // our float → into our cash
  | "opening" // opening balance / capital adjustment (funds an asset from equity)
  | "reversal"; // compensating entry voiding another entry

export const ENTRY_KINDS: EntryKind[] = [
  "wallet_send",
  "wallet_receive",
  "wallet_deposit",
  "wallet_withdraw",
  "opening",
  "reversal",
];

export interface EntryMeta {
  wallet?: WalletId;
  amount?: Piastres; // value moved through the wallet
  fee?: Piastres; // our charge on this operation
  cashDelta?: Piastres; // signed cash change
  walletDelta?: Piastres; // signed wallet-float change
  customer?: string;
  phone?: string;
  note?: string;
  ref?: string; // receipt / agent reference
  reverses?: string; // id of the entry this entry voids
}

export interface JournalEntry {
  id: string;
  kind: EntryKind;
  occurredAt: string; // ISO — when the money actually moved
  deviceId: string;
  postings: Posting[];
  meta: EntryMeta;
  createdAt: string;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export interface EntryTotals {
  debits: Piastres;
  credits: Piastres;
}

export function entryTotals(entry: JournalEntry): EntryTotals {
  let debits = 0;
  let credits = 0;
  for (const p of entry.postings) {
    debits += p.debit;
    credits += p.credit;
  }
  return { debits, credits };
}

export function isBalanced(entry: JournalEntry): boolean {
  const { debits, credits } = entryTotals(entry);
  return debits === credits && debits > 0;
}

/**
 * The invariant every entry must satisfy:
 *  - at least two postings
 *  - every posting is one-sided (debit xor credit), non-negative integer piastres
 *  - total debits === total credits > 0
 * Throws a machine-readable error code on violation.
 */
export function validateEntry(entry: JournalEntry): void {
  if (!entry.id) throw new Error("missing_id");
  if (!ENTRY_KINDS.includes(entry.kind)) throw new Error("unknown_kind");
  if (!entry.occurredAt || Number.isNaN(Date.parse(entry.occurredAt))) throw new Error("invalid_occurred_at");
  if (!Array.isArray(entry.postings) || entry.postings.length < 2) throw new Error("min_postings");

  let debits = 0;
  let credits = 0;
  for (const p of entry.postings) {
    if (!p.accountId) throw new Error("missing_account");
    assertIntegerPiastres(p.debit, "debit");
    assertIntegerPiastres(p.credit, "credit");
    if (p.debit < 0 || p.credit < 0) throw new Error("negative_amount");
    if (p.debit > 0 && p.credit > 0) throw new Error("posting_both_sides");
    if (p.debit === 0 && p.credit === 0) throw new Error("posting_empty");
    debits += p.debit;
    credits += p.credit;
  }
  if (debits !== credits) throw new Error("unbalanced_entry");
  if (debits <= 0) throw new Error("zero_entry");
}

/**
 * Derived balances for all known accounts.
 * Raw net = Σdebit − Σcredit; then signed by account type.
 * Accounts referenced by entries but not yet known locally are assumed
 * asset-type (receivables) — they appear rather than silently vanish.
 */
export function accountBalances(accounts: Account[], entries: JournalEntry[]): Record<string, Piastres> {
  const raw = new Map<string, number>();
  const types = new Map<string, AccountType>();
  for (const a of accounts) {
    raw.set(a.id, 0);
    types.set(a.id, a.type);
  }
  for (const entry of entries) {
    for (const p of entry.postings) {
      raw.set(p.accountId, (raw.get(p.accountId) ?? 0) + p.debit - p.credit);
    }
  }
  const out: Record<string, Piastres> = {};
  for (const [accountId, net] of raw) {
    const type = types.get(accountId) ?? "asset";
    out[accountId] = applySign(type, net);
  }
  return out;
}

/** Entries that void a given entry (or the entry that voids it), for UI badges. */
export function reversalTarget(entry: JournalEntry): string | null {
  if (entry.kind === "reversal" && entry.meta.reverses) return entry.meta.reverses;
  return null;
}

/** Build the compensating entry that voids `original`. Never mutates history. */
export function buildReversal(original: JournalEntry, deviceId: string, occurredAt?: string): JournalEntry {
  if (original.kind === "reversal") throw new Error("cannot_reverse_reversal");
  const at = occurredAt ?? nowIso();
  const entry: JournalEntry = {
    id: newId(),
    kind: "reversal",
    occurredAt: at,
    deviceId,
    postings: original.postings.map((p) => ({
      accountId: p.accountId,
      debit: p.credit,
      credit: p.debit,
    })),
    meta: {
      wallet: original.meta.wallet,
      reverses: original.id,
      amount: original.meta.amount,
      fee: original.meta.fee,
      cashDelta: original.meta.cashDelta !== undefined ? -original.meta.cashDelta : undefined,
      walletDelta: original.meta.walletDelta !== undefined ? -original.meta.walletDelta : undefined,
      note: original.meta.note,
    },
    createdAt: at,
  };
  validateEntry(entry);
  return entry;
}
