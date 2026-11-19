import type { AppBackup } from "./backupService";

const DATABASE_NAME = "basata-local-backup";
const STORE_NAME = "state";
const FOLDER_KEY = "folder";
const LAST_BACKUP_KEY = "lastBackupAtIso";

type Permission = "granted" | "prompt" | "denied";

interface BackupFileWriter {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface BackupFileHandle {
  createWritable(): Promise<BackupFileWriter>;
}

interface BackupDirectoryHandle {
  queryPermission(options: { mode: "readwrite" }): Promise<Permission>;
  requestPermission(options: { mode: "readwrite" }): Promise<Permission>;
  getFileHandle(name: string, options: { create: true }): Promise<BackupFileHandle>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options: { mode: "readwrite" }) => Promise<BackupDirectoryHandle>;
  }
}

interface FolderRecord {
  key: typeof FOLDER_KEY;
  handle: BackupDirectoryHandle;
}

interface LastBackupRecord {
  key: typeof LAST_BACKUP_KEY;
  value: string;
  date: string;
  sourceCreatedAtIso: string;
}

export type LocalDailyBackupPermission = Permission | "unsupported" | "not-configured";

export interface LocalDailyBackupStatus {
  permission: LocalDailyBackupPermission;
  lastBackupAtIso?: string;
}

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        databasePromise = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error ?? new Error("local_backup_database_open_failed"));
    };
    request.onblocked = () => {
      databasePromise = undefined;
      reject(new Error("local_backup_database_blocked"));
    };
  });
  return databasePromise;
}

async function readRecord<T>(key: string, guard: (value: unknown) => value is T): Promise<T | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => {
      const value: unknown = request.result;
      if (value === undefined) {
        resolve(undefined);
      } else if (guard(value)) {
        resolve(value);
      } else {
        reject(new Error("local_backup_record_invalid"));
      }
    };
    request.onerror = () => {
      reject(request.error ?? new Error("local_backup_record_read_failed"));
    };
  });
}

async function writeRecords(records: Array<FolderRecord | LastBackupRecord>): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    for (const record of records) store.put(record);
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("local_backup_record_write_failed"));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("local_backup_record_write_aborted"));
    };
  });
}

function writeRecord(record: FolderRecord | LastBackupRecord): Promise<void> {
  return writeRecords([record]);
}

function isFolderRecord(value: unknown): value is FolderRecord {
  return typeof value === "object" && value !== null &&
    "key" in value && value.key === FOLDER_KEY &&
    "handle" in value && isBackupDirectoryHandle(value.handle);
}

function isLastBackupRecord(value: unknown): value is LastBackupRecord {
  return typeof value === "object" && value !== null &&
    "key" in value && value.key === LAST_BACKUP_KEY &&
    "value" in value && typeof value.value === "string" &&
    "date" in value && typeof value.date === "string" &&
    "sourceCreatedAtIso" in value && typeof value.sourceCreatedAtIso === "string";
}

function isBackupDirectoryHandle(value: unknown): value is BackupDirectoryHandle {
  return typeof value === "object" && value !== null &&
    "queryPermission" in value && typeof value.queryPermission === "function" &&
    "requestPermission" in value && typeof value.requestPermission === "function" &&
    "getFileHandle" in value && typeof value.getFileHandle === "function";
}

async function getFolderHandle(): Promise<BackupDirectoryHandle | undefined> {
  const record = await readRecord(FOLDER_KEY, isFolderRecord);
  return record?.handle;
}

function announceFolderChange(): void {
  window.dispatchEvent(new Event("basata-local-backup-folder-changed"));
}

export async function getLocalDailyBackupStatus(): Promise<LocalDailyBackupStatus> {
  if (typeof window.showDirectoryPicker !== "function") return { permission: "unsupported" };

  const handle = await getFolderHandle();
  const lastBackup = await readRecord(LAST_BACKUP_KEY, isLastBackupRecord);
  if (!handle) return { permission: "not-configured", ...(lastBackup ? { lastBackupAtIso: lastBackup.value } : {}) };

  return {
    permission: await handle.queryPermission({ mode: "readwrite" }),
    ...(lastBackup ? { lastBackupAtIso: lastBackup.value } : {}),
  };
}

export async function chooseLocalDailyBackupFolder(): Promise<void> {
  if (typeof window.showDirectoryPicker !== "function") throw new Error("local_backup_not_supported");

  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  const permission = await handle.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") throw new Error("local_backup_permission_denied");

  await writeRecords([
    { key: FOLDER_KEY, handle },
    { key: LAST_BACKUP_KEY, value: "", date: "", sourceCreatedAtIso: "" },
  ]);
  announceFolderChange();
}

export async function requestLocalDailyBackupPermission(): Promise<Permission> {
  const handle = await getFolderHandle();
  if (!handle) throw new Error("local_backup_folder_not_configured");

  const permission = await handle.requestPermission({ mode: "readwrite" });
  announceFolderChange();
  return permission;
}

export async function writeDailyLocalBackup(backup: AppBackup): Promise<void> {
  const handle = await getFolderHandle();
  if (!handle) throw new Error("local_backup_folder_not_configured");
  if (await handle.queryPermission({ mode: "readwrite" }) !== "granted") {
    throw new Error("local_backup_permission_required");
  }

  const now = new Date();
  const date = localDate(now);
  const previous = await readRecord(LAST_BACKUP_KEY, isLastBackupRecord);
  if (previous?.date === date && previous.sourceCreatedAtIso === backup.createdAtIso) return;

  const filename = `basata-tech-backup-${date}.json`;
  const file = await handle.getFileHandle(filename, { create: true });
  const writer = await file.createWritable();
  await writer.write(JSON.stringify(backup, null, 2));
  await writer.close();

  await writeRecord({
    key: LAST_BACKUP_KEY,
    value: now.toISOString(),
    date,
    sourceCreatedAtIso: backup.createdAtIso,
  });
  window.dispatchEvent(new Event("basata-local-backup-updated"));
}

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
