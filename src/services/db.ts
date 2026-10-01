import Dexie, { type Table } from "dexie";
import type { Account, Operation } from "../accounting/types";

/**
 * CASHY persistence: IndexedDB via Dexie — LOCAL ONLY.
 * No backend, no sync: data lives in this browser/device (see README "Known limitations").
 */
export interface SettingsRow {
  key: "previewData";
  value: string; // "1" | "0"
}

export interface ProfileRow {
  id: "me";
  name: string;
  email: string;
}

class CashyDB extends Dexie {
  accounts!: Table<Account, string>;
  operations!: Table<Operation, string>;
  settings!: Table<SettingsRow, string>;
  profile!: Table<ProfileRow, string>;

  constructor() {
    super("cashy");
    this.version(1).stores({
      accounts: "id, phone, createdAtIso, archivedAtIso",
      operations: "id, accountId, type, occurredAtIso, createdAtIso, [accountId+type]",
      settings: "key",
      profile: "id",
    });
  }
}

export const db = new CashyDB();

/** All operations, newest first (occurredAt desc, createdAt desc as tie-break). */
export async function allOperations(): Promise<Operation[]> {
  const ops = await db.operations.toArray();
  return ops.sort((a, b) => {
    const t = b.occurredAtIso.localeCompare(a.occurredAtIso);
    return t !== 0 ? t : b.createdAtIso.localeCompare(a.createdAtIso);
  });
}

export async function allAccounts(includeArchived = false): Promise<Account[]> {
  const accounts = await db.accounts.toArray();
  const visible = includeArchived ? accounts : accounts.filter((a) => !a.archivedAtIso);
  return visible.sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso) || a.phone.localeCompare(b.phone));
}
