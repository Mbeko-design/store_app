import type { AppBackup } from "./backupService";
import { createBackup } from "./backupService";
import { decryptBackup, encryptBackup } from "./cloudBackupCrypto";

export interface CloudBackupStatus {
  connected: boolean;
  email?: string;
  hasSnapshot?: boolean;
  hasDriveBackup?: boolean;
  lastSyncedAtIso?: string;
  lastDriveBackupAtIso?: string;
}

export async function getCloudBackupStatus(): Promise<CloudBackupStatus> {
  const response = await fetch("/api/cloud-status", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("cloud_backup_status_failed");
  return response.json() as Promise<CloudBackupStatus>;
}

export async function syncEncryptedBackup(backup: AppBackup): Promise<void> {
  const encrypted = await encryptBackup(backup);
  const response = await fetch("/api/cloud-backup", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: encrypted,
  });
  if (!response.ok) throw new Error(await errorCode(response, "cloud_backup_sync_failed"));
  window.dispatchEvent(new Event("basata-cloud-backup-updated"));
}

export async function uploadCurrentBackupToDrive(): Promise<void> {
  await syncEncryptedBackup(await createBackup());
  const response = await fetch("/api/drive-upload", {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await errorCode(response, "drive_upload_failed"));
  window.dispatchEvent(new Event("basata-cloud-backup-updated"));
}

export async function downloadDriveBackup(passphrase?: string): Promise<AppBackup> {
  const response = await fetch("/api/drive-backup", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await errorCode(response, "drive_backup_download_failed"));
  return decryptBackup(await response.text(), passphrase);
}

async function errorCode(response: Response, fallback: string): Promise<string> {
  try {
    const value: unknown = await response.json();
    if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") {
      return value.error;
    }
  } catch {
    return fallback;
  }
  return fallback;
}
