import { handleSchedule } from "@vercel/schedules";
import { allDriveConnections, uploadSnapshotToDrive } from "./_lib/googleDrive";

export const POST = handleSchedule(async () => {
  const connections = await allDriveConnections();
  const results = await Promise.allSettled(connections.map(({ email }) => uploadSnapshotToDrive(email)));
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) throw new Error(`weekly_drive_backup_failed:${failures.length}`);
});
