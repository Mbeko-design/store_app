import { uploadSnapshotToDrive } from "./_lib/googleDrive";
import { readSessionEmail } from "./_lib/session";

export async function POST(request: Request): Promise<Response> {
  const email = readSessionEmail(request);
  if (!email) return Response.json({ error: "google_account_required" }, { status: 401 });
  await uploadSnapshotToDrive(email);
  return Response.json({ uploadedAtIso: new Date().toISOString() }, { status: 200 });
}
