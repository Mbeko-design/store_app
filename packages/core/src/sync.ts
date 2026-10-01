import type { Account } from "./accounts.js";
import type { JournalEntry } from "./ledger.js";
import { newId, nowIso, validateEntry } from "./ledger.js";

/**
 * Sync protocol — devices exchange immutable events.
 *
 * Money events are append-only: merges are a plain union, so offline devices
 * can never conflict. Corrections are new (reversal) events, never edits.
 */
export type SyncEventKind = "journal_entry" | "account_upsert";

export const SYNC_EVENT_KINDS: SyncEventKind[] = ["journal_entry", "account_upsert"];

export interface SyncEvent {
  /** Client-generated UUID — idempotency key (server dedupes on it). */
  uuid: string;
  kind: SyncEventKind;
  /** Event time on the device that produced it. */
  occurredAt: string;
  deviceId: string;
  payload: JournalEntry | Account;
  /** Server sequence — assigned on pull, not pushed by clients. */
  seq?: number;
}

export function isSyncEventKind(value: unknown): value is SyncEventKind {
  return typeof value === "string" && (SYNC_EVENT_KINDS as string[]).includes(value);
}

export interface PushEventInput {
  uuid?: unknown;
  kind?: unknown;
  occurredAt?: unknown;
  deviceId?: unknown;
  payload?: unknown;
}

/**
 * Server-side (or client-side) validation of an incoming pushed event.
 * Throws a machine-readable error code on violation.
 */
export function validatePushEvent(ev: PushEventInput, expectedDeviceId?: string): void {
  if (typeof ev.uuid !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ev.uuid)) {
    throw new Error("bad_uuid");
  }
  if (!isSyncEventKind(ev.kind)) throw new Error("bad_kind");
  if (typeof ev.occurredAt !== "string" || Number.isNaN(Date.parse(ev.occurredAt))) throw new Error("bad_occurred_at");
  if (typeof ev.deviceId !== "string" || ev.deviceId.length === 0 || ev.deviceId.length > 128) {
    throw new Error("bad_device_id");
  }
  if (expectedDeviceId && ev.deviceId !== expectedDeviceId) throw new Error("device_mismatch");
  if (!ev.payload || typeof ev.payload !== "object") throw new Error("bad_payload");

  if (ev.kind === "journal_entry") {
    const entry = ev.payload as JournalEntry;
    if (entry.id !== ev.uuid) throw new Error("entry_uuid_mismatch");
    validateEntry(entry);
    if (entry.deviceId !== ev.deviceId) throw new Error("device_mismatch");
  } else {
    const account = ev.payload as Account;
    if (typeof account.id !== "string" || !account.id) throw new Error("bad_account_id");
    if (!account.code || typeof account.code !== "string") throw new Error("bad_account_code");
    if (!["asset", "liability", "equity", "income", "expense"].includes(account.type)) throw new Error("bad_account_type");
    if (!account.nameAr || !account.nameEn) throw new Error("bad_account_name");
  }
}

/** Build the wire event for a local journal entry. */
export function entryToEvent(entry: JournalEntry): SyncEvent {
  return {
    uuid: entry.id,
    kind: "journal_entry",
    occurredAt: entry.occurredAt,
    deviceId: entry.deviceId,
    payload: entry,
  };
}

/**
 * Build the wire event for a created/updated account.
 * Each change is a fresh event (random uuid) so replays apply in order —
 * last write wins, and pushes are idempotent on the event uuid.
 */
export function accountToEvent(account: Account, deviceId = "system"): SyncEvent {
  return {
    uuid: newId(),
    kind: "account_upsert",
    occurredAt: nowIso(),
    deviceId,
    payload: account,
  };
}
