import type { Account, Operation } from "../accounting/types";
import type { Product, Receipt, ShopAsset, StockMove } from "../shop/types";
import { db, type ProfileRow, type SettingsRow } from "./db";

const BACKUP_FORMAT = "basata-tech-backup";
const BACKUP_VERSION = 1;

export interface AppBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAtIso: string;
  data: {
    accounts: Account[];
    operations: Operation[];
    products: Product[];
    receipts: Receipt[];
    stockMoves: StockMove[];
    shopAssets: ShopAsset[];
    settings: SettingsRow[];
    profile: ProfileRow[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isAccount(value: unknown): value is Account {
  return isRecord(value) && isString(value.id) && isString(value.phone) &&
    (value.label === undefined || isString(value.label)) &&
    isNonNegativeInteger(value.limitMonthlyPiastres) && isNonNegativeInteger(value.openingBalancePiastres) &&
    isString(value.createdAtIso) && (value.archivedAtIso === null || isString(value.archivedAtIso));
}

function isOperation(value: unknown): value is Operation {
  return isRecord(value) && isString(value.id) && isString(value.accountId) &&
    ["withdraw", "deposit", "cash"].includes(String(value.type)) &&
    isNonNegativeInteger(value.amountPiastres) && isString(value.occurredAtIso) && isString(value.createdAtIso) &&
    (value.note === undefined || isString(value.note));
}

function isProduct(value: unknown): value is Product {
  return isRecord(value) && isString(value.id) && isString(value.barcode) && isString(value.name) &&
    isNonNegativeInteger(value.pricePiastres) &&
    (value.costPiastres === undefined || isNonNegativeInteger(value.costPiastres)) &&
    isString(value.createdAtIso) && (value.archivedAtIso === undefined || isString(value.archivedAtIso));
}

function isReceiptLine(value: unknown): boolean {
  return isRecord(value) && isString(value.productId) && isString(value.barcode) && isString(value.name) &&
    isNonNegativeInteger(value.pricePiastres) && isNonNegativeInteger(value.qty) &&
    (value.costPiastres === undefined || isNonNegativeInteger(value.costPiastres));
}

function isReceipt(value: unknown): value is Receipt {
  return isRecord(value) && isString(value.id) && isNonNegativeInteger(value.number) &&
    Array.isArray(value.lines) && value.lines.every(isReceiptLine) && isNonNegativeInteger(value.totalPiastres) &&
    (value.subtotalPiastres === undefined || isNonNegativeInteger(value.subtotalPiastres)) &&
    (value.discountCode === undefined || (isString(value.discountCode) && value.discountCode.length <= 60)) &&
    (value.discountPercent === undefined ||
      (typeof value.discountPercent === "number" && Number.isFinite(value.discountPercent) &&
        value.discountPercent > 0 && value.discountPercent <= 100)) &&
    (value.discountPiastres === undefined || isNonNegativeInteger(value.discountPiastres)) &&
    ["cash", "vodafone"].includes(String(value.paymentMethod)) && isString(value.createdAtIso);
}

function isStockMove(value: unknown): value is StockMove {
  return isRecord(value) && isString(value.id) && isString(value.productId) &&
    ["in", "sale", "adjust"].includes(String(value.type)) && Number.isSafeInteger(value.qty) &&
    isString(value.createdAtIso) && (value.refReceiptId === undefined || isString(value.refReceiptId)) &&
    (value.supplierName === undefined || (isString(value.supplierName) && value.supplierName.length <= 80)) &&
    (value.note === undefined || isString(value.note));
}

type BackupShopAsset = Omit<ShopAsset, "owner"> & { owner?: ShopAsset["owner"] };

function isShopAsset(value: unknown): value is BackupShopAsset {
  return isRecord(value) && isString(value.id) && isString(value.name) && isNonNegativeInteger(value.pricePiastres) &&
    (value.owner === undefined || value.owner === "fouad" || value.owner === "saad") &&
    (value.note === undefined || isString(value.note)) &&
    isString(value.createdAtIso);
}

function isSettingsRow(value: unknown): value is SettingsRow {
  return isRecord(value) && (value.key === "previewData" || value.key === "receiptSeq") && isString(value.value);
}

function isProfileRow(value: unknown): value is ProfileRow {
  return isRecord(value) && value.id === "me" && isString(value.name) && isString(value.email);
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

export async function createBackup(): Promise<AppBackup> {
  const [accounts, operations, products, receipts, stockMoves, shopAssets, settings, profile] = await db.transaction(
    "r",
    [db.accounts, db.operations, db.products, db.receipts, db.stockMoves, db.shopAssets, db.settings, db.profile],
    () => Promise.all([
      db.accounts.toArray(),
      db.operations.toArray(),
      db.products.toArray(),
      db.receipts.toArray(),
      db.stockMoves.toArray(),
      db.shopAssets.toArray(),
      db.settings.toArray(),
      db.profile.toArray(),
    ]),
  );
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAtIso: new Date().toISOString(),
    data: { accounts, operations, products, receipts, stockMoves, shopAssets, settings, profile },
  };
}

export function parseBackup(text: string): AppBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("invalid_backup_json");
  }
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION ||
      !isString(parsed.createdAtIso) || !isRecord(parsed.data)) {
    throw new Error("unsupported_backup");
  }

  const data = parsed.data;
  if (!isArrayOf(data.accounts, isAccount) ||
      !isArrayOf(data.operations, isOperation) ||
      !isArrayOf(data.products, isProduct) ||
      !isArrayOf(data.receipts, isReceipt) ||
      !isArrayOf(data.stockMoves, isStockMove) ||
      !isArrayOf(data.shopAssets, isShopAsset) ||
      !isArrayOf(data.settings, isSettingsRow) ||
      !isArrayOf(data.profile, isProfileRow)) {
    throw new Error("invalid_backup_data");
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAtIso: parsed.createdAtIso,
    data: {
      accounts: data.accounts,
      operations: data.operations,
      products: data.products,
      receipts: data.receipts,
      stockMoves: data.stockMoves,
      shopAssets: data.shopAssets.map((asset) => ({ ...asset, owner: asset.owner ?? "fouad" })),
      settings: data.settings,
      profile: data.profile,
    },
  };
}

export async function downloadBackup(): Promise<void> {
  const backup = await createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `basata-tech-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function restoreBackup(backup: AppBackup): Promise<void> {
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
      if (backup.data.accounts.length) await db.accounts.bulkAdd(backup.data.accounts);
      if (backup.data.operations.length) await db.operations.bulkAdd(backup.data.operations);
      if (backup.data.products.length) await db.products.bulkAdd(backup.data.products);
      if (backup.data.receipts.length) await db.receipts.bulkAdd(backup.data.receipts);
      if (backup.data.stockMoves.length) await db.stockMoves.bulkAdd(backup.data.stockMoves);
      if (backup.data.shopAssets.length) await db.shopAssets.bulkAdd(backup.data.shopAssets);
      if (backup.data.settings.length) await db.settings.bulkAdd(backup.data.settings);
      if (backup.data.profile.length) await db.profile.bulkAdd(backup.data.profile);
    },
  );
}
