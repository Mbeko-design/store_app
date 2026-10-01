import type { Account, JournalEntry, SyncEvent } from "@mizan/core";
import { entryToEvent } from "@mizan/core";
import { db } from "../db/schema";
import { API_URL, authHeaders, getDeviceId, getToken, clearSession } from "./token";

export interface SyncState {
  syncing: boolean;
  lastSyncAt: number | null;
  error: string | null;
}

let state: SyncState = { syncing: false, lastSyncAt: null, error: null };
const listeners = new Set<() => void>();

function patch(next: Partial<SyncState>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncState(): SyncState {
  return state;
}

let started = false;
let scheduled: number | null = null;
let running = false;

/** Boot the engine: initial sync, periodic retry, and on reconnect. */
export function startSyncEngine(): void {
  if (started) return;
  started = true;
  window.addEventListener("online", () => void runSync());
  window.setInterval(() => void runSync(), 20_000);
  void runSync();
}

/** Debounced trigger after local writes. */
export function scheduleSync(): void {
  if (scheduled) window.clearTimeout(scheduled);
  scheduled = window.setTimeout(() => void runSync(), 2_500);
}

export async function runSync(): Promise<void> {
  const token = getToken();
  if (!token || running) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  running = true;
  patch({ syncing: true });
  try {
    await pushPending(token);
    await pullRemote(token);
    patch({ lastSyncAt: Date.now(), error: null });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      clearSession();
      window.dispatchEvent(new CustomEvent("mizan:unauthorized"));
    }
    patch({ error: err instanceof Error ? err.message : "sync_failed" });
  } finally {
    running = false;
    patch({ syncing: false });
  }
}

class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
  }
}

function throwIfBad(res: Response): void {
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`http_${res.status}`);
}

async function pushPending(token: string): Promise<void> {
  const pending = await db.entries.where("synced").equals(0).limit(500).toArray();
  if (pending.length === 0) return;

  const events = pending.map((e) => {
    const { synced: _synced, seq: _seq, ...entry } = e;
    return entryToEvent(entry as JournalEntry);
  });

  const res = await fetch(`${API_URL}/api/sync/push`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ deviceId: getDeviceId(), events }),
  });
  throwIfBad(res);
  if (!res.ok) throw new Error("push_failed");

  await db.entries.where("id").anyOf(pending.map((e) => e.id)).modify({ synced: 1 });
}

async function pullRemote(token: string): Promise<void> {
  const maxPages = 50;
  for (let page = 0; page < maxPages; page++) {
    const row = await db.settings.get("lastSeq");
    const since = Number(row?.value ?? "0") || 0;

    const res = await fetch(`${API_URL}/api/sync/pull?since=${since}`, { headers: authHeaders(token) });
    throwIfBad(res);
    if (!res.ok) throw new Error("pull_failed");

    const data = (await res.json()) as { events: SyncEvent[]; serverSeq: number };
    await applyEvents(data.events);

    const nextSince = Number(data.serverSeq ?? since) || since;
    await db.settings.put({ key: "lastSeq", value: String(nextSince) });

    if (!data.events || data.events.length === 0) break;
  }
}

/**
 * Apply pulled events.
 * Entries are immutable: if we already have the id we only update sync
 * bookkeeping (never content). Accounts upsert in sequence order (last wins).
 */
async function applyEvents(events: SyncEvent[]): Promise<void> {
  for (const ev of events) {
    if (ev.kind === "journal_entry") {
      const entry = ev.payload as JournalEntry;
      const exists = await db.entries.get(entry.id);
      if (!exists) {
        await db.entries.put({ ...entry, synced: 1, seq: ev.seq ?? 0 });
      } else {
        await db.entries.update(entry.id, { seq: ev.seq ?? 0, synced: 1 });
      }
    } else if (ev.kind === "account_upsert") {
      await db.accounts.put(ev.payload as Account);
    }
  }
}
