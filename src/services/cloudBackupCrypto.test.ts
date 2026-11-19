import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { decryptBackup, encryptBackup, saveCloudBackupPassphrase } from "./cloudBackupCrypto";
import { parseBackup, type AppBackup } from "./backupService";

const keyDatabaseName = "basata-cloud-backup";

function emptyBackup(): AppBackup {
  return parseBackup(JSON.stringify({
    format: "basata-tech-backup",
    version: 1,
    createdAtIso: "2025-01-01T00:00:00.000Z",
    data: {
      accounts: [],
      operations: [],
      products: [],
      receipts: [],
      returns: [],
      stockMoves: [],
      shopAssets: [],
      settings: [],
      profile: [{ id: "me", name: "Sensitive Name", email: "private@example.com" }],
    },
  }));
}

async function deleteKeyDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(keyDatabaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("backup_key_database_delete_failed"));
    request.onblocked = () => reject(new Error("backup_key_database_delete_blocked"));
  });
}

describe("cloud backup encryption", () => {
  beforeEach(deleteKeyDatabase);

  it("encrypts backup content and restores it with the local key", async () => {
    const backup = emptyBackup();
    await saveCloudBackupPassphrase("a-long-backup-passphrase");

    const encrypted = await encryptBackup(backup);

    expect(encrypted).not.toContain("Sensitive Name");
    expect(encrypted).not.toContain("private@example.com");
    await expect(decryptBackup(encrypted)).resolves.toEqual(backup);
  });

  it("rejects a wrong passphrase when restoring on a device without the local key", async () => {
    await saveCloudBackupPassphrase("the-correct-backup-passphrase");
    const encrypted = await encryptBackup(emptyBackup());
    await deleteKeyDatabase();

    await expect(decryptBackup(encrypted, "an-incorrect-backup-passphrase"))
      .rejects.toThrow("backup_passphrase_invalid");
  });
});
