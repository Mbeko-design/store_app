import type { ShopAsset } from "../shop/types";
import { newId } from "../utils/labels";
import { db } from "./db";

/** Fixed equipment/assets (رأس المال الثابت) — ماسح باركود, طابعة, أرفف… simple CRUD, own table. */

/** All assets, Arabic name order. */
export async function listAssets(): Promise<ShopAsset[]> {
  const assets = await db.shopAssets.toArray();
  return assets.sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export async function createAsset(input: {
  name: string;
  pricePiastres: number;
  owner: ShopAsset["owner"];
  note?: string;
}): Promise<ShopAsset> {
  const name = input.name.trim();
  if (!name) throw new Error("invalid_name");
  const asset: ShopAsset = {
    id: newId(),
    name,
    pricePiastres: input.pricePiastres,
    owner: input.owner,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    createdAtIso: new Date().toISOString(),
  };
  await db.shopAssets.put(asset);
  return asset;
}

export async function updateAsset(
  id: string,
  patch: { name?: string; pricePiastres?: number; owner?: ShopAsset["owner"]; note?: string },
): Promise<ShopAsset> {
  const existing = await db.shopAssets.get(id);
  if (!existing) throw new Error("not_found");
  const updated: ShopAsset = {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.pricePiastres !== undefined ? { pricePiastres: patch.pricePiastres } : {}),
    ...(patch.owner !== undefined ? { owner: patch.owner } : {}),
    ...(patch.note !== undefined ? (patch.note.trim() ? { note: patch.note.trim() } : { note: undefined }) : {}),
  };
  // keep the stored row shape clean (undefined note key removed)
  const clean: ShopAsset = {
    id: updated.id,
    name: updated.name,
    pricePiastres: updated.pricePiastres,
    owner: updated.owner ?? "fouad",
    ...(updated.note ? { note: updated.note } : {}),
    createdAtIso: updated.createdAtIso,
  };
  await db.shopAssets.put(clean);
  return clean;
}

/** Removing an asset is allowed (sold / broken / replaced) — it never hits the ledger. */
export async function deleteAsset(id: string): Promise<void> {
  await db.shopAssets.delete(id);
}
