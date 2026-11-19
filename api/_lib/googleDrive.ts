import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { emailKey } from "./session";
import { listPrivateBlobs, readPrivateJson, readPrivateText, writePrivateJson } from "./storage";

export interface DriveConnection {
  email: string;
  encryptedRefreshToken: string;
  connectedAtIso: string;
  lastDriveBackupAtIso?: string;
}

export function connectionPath(email: string): string {
  return `drive-connections/${emailKey(email)}.json`;
}

export function snapshotPath(email: string): string {
  return `backup-snapshots/${emailKey(email)}.enc`;
}

export async function getDriveConnection(email: string): Promise<DriveConnection | null> {
  return readPrivateJson<DriveConnection>(connectionPath(email));
}

export async function saveDriveConnection(connection: DriveConnection): Promise<void> {
  await writePrivateJson(connectionPath(connection.email), connection);
}

export async function allDriveConnections(): Promise<DriveConnection[]> {
  const paths = await listPrivateBlobs("drive-connections/");
  const connections = await Promise.all(paths.map((path) => readPrivateJson<DriveConnection>(path)));
  return connections.filter((connection): connection is DriveConnection => connection !== null);
}

export async function uploadSnapshotToDrive(email: string): Promise<void> {
  const connection = await getDriveConnection(email);
  if (!connection) throw new Error("drive_connection_missing");

  const snapshot = await readPrivateText(snapshotPath(email));
  if (!snapshot) throw new Error("cloud_snapshot_missing");

  const accessToken = await getDriveAccessToken(connection);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const filename = `Basata-Tech-Backup-${date}.basata.enc`;
  const query = new URLSearchParams({
    q: `name = '${filename}' and trashed = false`,
    spaces: "drive",
    pageSize: "10",
    fields: "files(id,name)",
  });
  const listResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!listResponse.ok) throw new Error("google_drive_list_failed");
  const filesPayload: unknown = await listResponse.json();
  const existingId = isRecord(filesPayload) && Array.isArray(filesPayload.files)
    ? filesPayload.files.find((file) => isRecord(file) && typeof file.id === "string")?.id
    : undefined;

  if (typeof existingId === "string") {
    const updateResponse = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingId)}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/octet-stream",
        },
        body: snapshot.text,
      },
    );
    if (!updateResponse.ok) throw new Error("google_drive_update_failed");
  } else {
    const boundary = `basata_${crypto.randomUUID().replace(/-/g, "")}`;
    const metadata = JSON.stringify({ name: filename, mimeType: "application/octet-stream" });
    const body = [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}`,
      `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n${snapshot.text}`,
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const createResponse = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!createResponse.ok) throw new Error("google_drive_create_failed");
  }

  await saveDriveConnection({
    ...connection,
    lastDriveBackupAtIso: new Date().toISOString(),
  });
}

export async function downloadLatestBackupFromDrive(email: string): Promise<string | null> {
  const connection = await getDriveConnection(email);
  if (!connection) throw new Error("drive_connection_missing");

  const accessToken = await getDriveAccessToken(connection);
  const query = new URLSearchParams({
    q: "name contains 'Basata-Tech-Backup-' and trashed = false",
    spaces: "drive",
    pageSize: "1",
    orderBy: "modifiedTime desc",
    fields: "files(id,name)",
  });
  const listResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!listResponse.ok) throw new Error("google_drive_list_failed");
  const filesPayload: unknown = await listResponse.json();
  const fileId = isRecord(filesPayload) && Array.isArray(filesPayload.files)
    ? filesPayload.files.find((file) => isRecord(file) && typeof file.id === "string")?.id
    : undefined;
  if (typeof fileId !== "string") return null;

  const fileResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (!fileResponse.ok) throw new Error("google_drive_download_failed");
  return fileResponse.text();
}

async function getDriveAccessToken(connection: DriveConnection): Promise<string> {
  const refreshToken = decryptRefreshToken(connection.encryptedRefreshToken);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenResponse.ok) throw new Error("google_token_refresh_failed");
  const tokenPayload: unknown = await tokenResponse.json();
  if (!isRecord(tokenPayload) || typeof tokenPayload.access_token !== "string") {
    throw new Error("google_token_refresh_invalid");
  }
  return tokenPayload.access_token;
}

export async function saveOAuthConnection(
  email: string,
  refreshToken: string | undefined,
): Promise<void> {
  const existing = await getDriveConnection(email);
  const encryptedRefreshToken = refreshToken
    ? encryptRefreshToken(refreshToken)
    : existing?.encryptedRefreshToken;
  if (!encryptedRefreshToken) throw new Error("google_refresh_token_missing");
  await saveDriveConnection({
    email,
    encryptedRefreshToken,
    connectedAtIso: existing?.connectedAtIso ?? new Date().toISOString(),
    ...(existing?.lastDriveBackupAtIso ? { lastDriveBackupAtIso: existing.lastDriveBackupAtIso } : {}),
  });
}

export async function getSnapshotStatus(email: string): Promise<{ hasSnapshot: boolean; uploadedAtIso?: string }> {
  const snapshot = await readPrivateText(snapshotPath(email));
  return snapshot
    ? { hasSnapshot: true, uploadedAtIso: snapshot.uploadedAt.toISOString() }
    : { hasSnapshot: false };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function refreshTokenKey(): Buffer {
  const value = requiredEnv("APP_SESSION_SECRET");
  return createHmac("sha256", value).update("basata-google-drive-refresh-token").digest();
}

function encryptRefreshToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", refreshTokenKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

function decryptRefreshToken(value: string): string {
  const payload = Buffer.from(value, "base64url");
  if (payload.length < 29) throw new Error("google_refresh_token_invalid");
  const decipher = createDecipheriv("aes-256-gcm", refreshTokenKey(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  try {
    return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("google_refresh_token_decryption_failed");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
