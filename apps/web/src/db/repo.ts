import {
  accountBalances,
  buildReversal,
  seedAccounts,
  validateEntry,
  type Account,
  type JournalEntry,
  type Piastres,
} from "@mizan/core";
import { db, type LocalEntry } from "./schema";
import { scheduleSync } from "../lib/sync";

/** Idempotent: seeds the fixed chart of accounts without touching dynamic ones. */
export async function ensureSeeded(): Promise<void> {
  for (const account of seedAccounts()) {
    const existing = await db.accounts.get(account.id);
    if (!existing) await db.accounts.put(account);
  }
}

/** Save a validated entry locally (offline-safe) and nudge the sync engine. */
export async function addEntry(entry: JournalEntry): Promise<void> {
  validateEntry(entry);
  await db.entries.put({ ...entry, synced: 0, seq: 0 });
  scheduleSync();
}

/** True if a reversal already voids this entry. */
export async function isReversed(entryId: string): Promise<boolean> {
  const found = await db.entries.where("kind").equals("reversal").filter((e) => e.meta.reverses === entryId).first();
  return Boolean(found);
}

/** Create the compensating entry that voids `entryId`. */
export async function reverseEntry(entryId: string, deviceId: string): Promise<JournalEntry> {
  const original = await db.entries.get(entryId);
  if (!original) throw new Error("entry_not_found");
  if (await isReversed(entryId)) throw new Error("already_reversed");
  const reversal = buildReversal(original, deviceId);
  await addEntry(reversal);
  return reversal;
}

export interface BalanceSnapshot {
  accounts: Account[];
  balances: Record<string, Piastres>;
}

export async function loadBalances(): Promise<BalanceSnapshot> {
  const [accounts, entries] = await Promise.all([db.accounts.toArray(), db.entries.toArray()]);
  return { accounts, balances: accountBalances(accounts, entries) };
}

export async function pendingCount(): Promise<number> {
  return db.entries.where("synced").equals(0).count();
}

export async function entryCount(): Promise<number> {
  return db.entries.count();
}

/** Local-day window: [local midnight, +∞) as ISO strings (comparable lexicographically). */
export function todayLowerBoundIso(now = new Date()): string {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return midnight.toISOString();
}

export function isToday(iso: string, now = new Date()): boolean {
  return iso >= todayLowerBoundIso(now);
}

export function sortDesc(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : a.id < b.id ? 1 : -1));
}
