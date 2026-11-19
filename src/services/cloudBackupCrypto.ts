import { parseBackup, type AppBackup } from "./backupService";

const KEY_DB_NAME = "basata-cloud-backup";
const KEY_STORE_NAME = "keys";
const KEY_ID = "main";

interface LocalKeyRecord {
  id: typeof KEY_ID;
  salt: string;
  key: CryptoKey;
}

export interface EncryptedBackup {
  format: "basata-tech-encrypted-backup";
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAtIso: string;
}

function openKeyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(KEY_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(KEY_STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("backup_key_database_open_failed"));
    request.onblocked = () => reject(new Error("backup_key_database_blocked"));
  });
}

async function readKeyRecord(): Promise<LocalKeyRecord | undefined> {
  const database = await openKeyDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(KEY_STORE_NAME, "readonly").objectStore(KEY_STORE_NAME).get(KEY_ID);
    request.onsuccess = () => {
      database.close();
      const value: unknown = request.result;
      resolve(isLocalKeyRecord(value) ? value : undefined);
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error("backup_key_read_failed"));
    };
  });
}

async function writeKeyRecord(record: LocalKeyRecord): Promise<void> {
  const database = await openKeyDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE_NAME, "readwrite");
    transaction.objectStore(KEY_STORE_NAME).put(record);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("backup_key_save_failed"));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("backup_key_save_aborted"));
    };
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toArrayBuffer(salt), iterations: 310_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function hasCloudBackupKey(): Promise<boolean> {
  return Boolean(await readKeyRecord());
}

export async function saveCloudBackupPassphrase(passphrase: string): Promise<void> {
  if (passphrase.length < 12) throw new Error("backup_passphrase_too_short");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await writeKeyRecord({
    id: KEY_ID,
    salt: toBase64(salt),
    key: await deriveKey(passphrase, salt),
  });
}

export async function encryptBackup(backup: AppBackup): Promise<string> {
  const record = await readKeyRecord();
  if (!record) throw new Error("backup_encryption_not_configured");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(backup));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, record.key, plaintext);
  const envelope: EncryptedBackup = {
    format: "basata-tech-encrypted-backup",
    version: 1,
    salt: record.salt,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
    createdAtIso: new Date().toISOString(),
  };
  return JSON.stringify(envelope);
}

export async function decryptBackup(text: string, passphrase?: string): Promise<AppBackup> {
  const envelope = parseEncryptedBackup(text);
  const localRecord = await readKeyRecord();
  let key = localRecord?.salt === envelope.salt ? localRecord.key : undefined;
  if (!key) {
    if (!passphrase) throw new Error("backup_passphrase_required");
    if (passphrase.length < 12) throw new Error("backup_passphrase_too_short");
    key = await deriveKey(passphrase, fromBase64(envelope.salt));
  }

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(fromBase64(envelope.iv)) },
      key,
      toArrayBuffer(fromBase64(envelope.ciphertext)),
    );
  } catch {
    throw new Error("backup_passphrase_invalid");
  }

  let backupText: string;
  try {
    backupText = new TextDecoder().decode(plaintext);
  } catch {
    throw new Error("encrypted_backup_invalid");
  }
  const backup = parseBackup(backupText);
  if (!localRecord || localRecord.salt !== envelope.salt) {
    await writeKeyRecord({ id: KEY_ID, salt: envelope.salt, key });
  }
  return backup;
}

function parseEncryptedBackup(text: string): EncryptedBackup {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("encrypted_backup_invalid");
  }
  if (
    typeof value !== "object" || value === null ||
    !("format" in value) || value.format !== "basata-tech-encrypted-backup" ||
    !("version" in value) || value.version !== 1 ||
    !("salt" in value) || typeof value.salt !== "string" ||
    !("iv" in value) || typeof value.iv !== "string" ||
    !("ciphertext" in value) || typeof value.ciphertext !== "string"
  ) throw new Error("encrypted_backup_invalid");
  return {
    format: "basata-tech-encrypted-backup",
    version: 1,
    salt: value.salt,
    iv: value.iv,
    ciphertext: value.ciphertext,
    createdAtIso: "createdAtIso" in value && typeof value.createdAtIso === "string"
      ? value.createdAtIso
      : "",
  };
}

function isLocalKeyRecord(value: unknown): value is LocalKeyRecord {
  return typeof value === "object" && value !== null &&
    "id" in value && value.id === KEY_ID &&
    "salt" in value && typeof value.salt === "string" &&
    "key" in value && typeof CryptoKey !== "undefined" && value.key instanceof CryptoKey;
}
