import { downloadLatestBackupFromDrive, snapshotPath } from "./_lib/googleDrive";
import { readSessionEmail } from "./_lib/session";
import { readPrivateText } from "./_lib/storage";

export async function GET(request: Request): Promise<Response> {
  const email = readSessionEmail(request);
  if (!email) return Response.json({ error: "google_account_required" }, { status: 401 });

  const driveBackup = await downloadLatestBackupFromDrive(email);
  const backup = driveBackup ?? (await readPrivateText(snapshotPath(email)))?.text;
  if (!backup) return Response.json({ error: "cloud_backup_not_found" }, { status: 404 });
  return new Response(backup, {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "no-store",
    },
  });
}
