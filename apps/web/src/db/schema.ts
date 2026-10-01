import Dexie, { type Table } from "dexie";
import type { Account, JournalEntry } from "@mizan/core";

/** A journal entry as stored locally, plus sync bookkeeping. */
export interface LocalEntry extends JournalEntry {
  /** 0 = waiting to be pushed, 1 = safely on the server. */
  synced: 0 | 1;
  /** Server sequence assigned when pulled back. */
  seq: number;
}

export interface SettingRow {
  key: string;
  value: string;
}

class MizanDB extends Dexie {
  entries!: Table<LocalEntry, string>;
  accounts!: Table<Account, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super("mizan");
    this.version(1).stores({
      entries: "id, synced, occurredAt, kind, [synced+occurredAt]",
      accounts: "id, code, type",
      settings: "key",
    });
  }
}

export const db = new MizanDB();
