import { snapshotPath } from "./_lib/googleDrive";
import { readPrivateText, writePrivateText } from "./_lib/storage";
import { readSessionEmail } from "./_lib/session";

const MAX_SNAPSHOT_BYTES = 4_000_000;

export async function GET(request: Request): Promise<Response> {
  const email = readSessionEmail(request);
  if (!email) return Response.json({ error: "google_account_required" }, { status: 401 });

  const snapshot = await readPrivateText(snapshotPath(email));
  if (!snapshot) return Response.json({ error: "cloud_backup_not_found" }, { status: 404 });
  return new Response(snapshot.text, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-backup-updated-at": snapshot.uploadedAt.toISOString(),
    },
  });
}

export async function PUT(request: Request): Promise<Response> {
  const email = readSessionEmail(request);
  if (!email) return Response.json({ error: "google_account_required" }, { status: 401 });

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_SNAPSHOT_BYTES) {
    return Response.json({ error: "backup_too_large" }, { status: 413 });
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_SNAPSHOT_BYTES || !isEncryptedBackup(body)) {
    return Response.json({ error: "invalid_encrypted_backup" }, { status: 400 });
  }

  await writePrivateText(snapshotPath(email), body);
  return Response.json({ uploadedAtIso: new Date().toISOString() }, { status: 200 });
}

function isEncryptedBackup(text: string): boolean {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return false;
  }
  return typeof value === "object" && value !== null &&
    "format" in value && value.format === "basata-tech-encrypted-backup" &&
    "version" in value && value.version === 1 &&
    "salt" in value && typeof value.salt === "string" &&
    "iv" in value && typeof value.iv === "string" &&
    "ciphertext" in value && typeof value.ciphertext === "string";
}
