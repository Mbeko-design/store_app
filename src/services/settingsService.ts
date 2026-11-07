import { db, type ProfileRow } from "./db";

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
 * Irreversible.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.accounts, db.operations, db.products, db.receipts, db.stockMoves, db.shopAssets, db.settings, db.profile],
    async () => {
      await Promise.all([
        db.accounts.clear(),
        db.operations.clear(),
        db.products.clear(),
        db.receipts.clear(),
        db.stockMoves.clear(),
        db.shopAssets.clear(),
        db.settings.clear(),
        db.profile.clear(),
      ]);
    },
  );
}
