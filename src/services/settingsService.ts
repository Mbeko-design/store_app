import { db, type ProfileRow } from "./db";

/**
 * Demo-mode flag (key kept as "previewData" for backwards compatibility):
 *   "1"  → demo/seed data is active (banner + reset are shown)
 *   "0"  → user explicitly wiped everything (never auto-seed again)
 *   null → never touched (true first run → auto-seed demo data)
 */
const DEMO_KEY = "previewData";

export async function getDemoFlag(): Promise<"1" | "0" | null> {
  const row = await db.settings.get(DEMO_KEY);
  if (row === undefined) return null;
  return row.value === "1" ? "1" : "0";
}

export async function setDemoFlag(enabled: boolean): Promise<void> {
  await db.settings.put({ key: DEMO_KEY, value: enabled ? "1" : "0" });
}

/** True while the app is showing clearly-marked demo data. */
export async function isDemoMode(): Promise<boolean> {
  return (await getDemoFlag()) === "1";
}

const DEFAULT_PROFILE: ProfileRow = { id: "me", name: "المستخدم", email: "" };

export async function getProfile(): Promise<ProfileRow> {
  return (await db.profile.get("me")) ?? DEFAULT_PROFILE;
}

export async function saveProfile(patch: Partial<Pick<ProfileRow, "name" | "email">>): Promise<void> {
  const current = await getProfile();
  await db.profile.put({ ...current, ...patch });
}

/**
 * Remove ALL local data (accounts, operations, shop, settings, profile).
 * Irreversible. Marks demo mode OFF so the first-run auto-seed never
 * resurrects data the user deliberately deleted.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.accounts, db.operations, db.products, db.receipts, db.stockMoves, db.settings, db.profile],
    async () => {
      await Promise.all([
        db.accounts.clear(),
        db.operations.clear(),
        db.products.clear(),
        db.receipts.clear(),
        db.stockMoves.clear(),
        db.settings.clear(),
        db.profile.clear(),
      ]);
      await db.settings.put({ key: DEMO_KEY, value: "0" });
    },
  );
}
