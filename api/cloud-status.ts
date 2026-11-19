import { getDriveConnection, getSnapshotStatus } from "./_lib/googleDrive";
import { readSessionEmail } from "./_lib/session";

export async function GET(request: Request): Promise<Response> {
  const email = readSessionEmail(request);
  if (!email) return Response.json({ connected: false }, { status: 200 });

  const [connection, snapshot] = await Promise.all([
    getDriveConnection(email),
    getSnapshotStatus(email),
  ]);
  if (!connection) return Response.json({ connected: false }, { status: 200 });
  return Response.json({
    connected: true,
    email: connection.email,
    hasSnapshot: snapshot.hasSnapshot,
    hasDriveBackup: Boolean(connection.lastDriveBackupAtIso),
    ...(snapshot.uploadedAtIso ? { lastSyncedAtIso: snapshot.uploadedAtIso } : {}),
    ...(connection.lastDriveBackupAtIso ? { lastDriveBackupAtIso: connection.lastDriveBackupAtIso } : {}),
  }, { headers: { "cache-control": "no-store" } });
}
