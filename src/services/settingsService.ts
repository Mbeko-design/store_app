import { db, type ProfileRow } from "./db";

const PREVIEW_KEY = "previewData";

/** Preview/sample data flag — sample rows are only ever loaded into an empty app. */
export async function isPreviewData(): Promise<boolean> {
  const row = await db.settings.get(PREVIEW_KEY);
  return row?.value === "1";
}

export async function setPreviewData(enabled: boolean): Promise<void> {
  await db.settings.put({ key: PREVIEW_KEY, value: enabled ? "1" : "0" });
}

const DEFAULT_PROFILE: ProfileRow = { id: "me", name: "المستخدم", email: "" };

export async function getProfile(): Promise<ProfileRow> {
  return (await db.profile.get("me")) ?? DEFAULT_PROFILE;
}

export async function saveProfile(patch: Partial<Pick<ProfileRow, "name" | "email">>): Promise<void> {
  const current = await getProfile();
  await db.profile.put({ ...current, ...patch });
}

/** Remove ALL local data (accounts, operations, settings, profile). Irreversible. */
export async function clearAllData(): Promise<void> {
  await db.transaction("rw", db.accounts, db.operations, db.settings, db.profile, async () => {
    await Promise.all([db.accounts.clear(), db.operations.clear(), db.settings.clear(), db.profile.clear()]);
  });
}
