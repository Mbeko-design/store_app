/**
 * Chart of accounts — every movement of value in the store lands on one of these.
 *
 * Sign convention (derived balances):
 *   asset / expense  → debit  − credit   (positive = we hold / we spent)
 *   liability / equity / income → credit − debit
 */
export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export interface Account {
  id: string;
  code: string;
  type: AccountType;
  nameAr: string;
  nameEn: string;
}

export const WALLET_IDS = ["vodafone", "orange", "eand", "instapay"] as const;
export type WalletId = (typeof WALLET_IDS)[number];

export const WALLET_ACCOUNT: Record<WalletId, string> = {
  vodafone: "wallet_vodafone",
  orange: "wallet_orange",
  eand: "wallet_eand",
  instapay: "wallet_instapay",
};

export const WALLET_NAMES: Record<WalletId, { ar: string; en: string }> = {
  vodafone: { ar: "فودافون كاش", en: "Vodafone Cash" },
  orange: { ar: "أورانج موني", en: "Orange Money" },
  eand: { ar: "e& موني", en: "E& Money" },
  instapay: { ar: "إنستاباي", en: "InstaPay" },
};

export const CASH_ACCOUNT = "cash_drawer";
export const FEES_INCOME_ACCOUNT = "fees_income";
export const BASATA_FLOAT_ACCOUNT = "basata_float";
export const INVENTORY_ACCOUNT = "inventory";

export function isWalletId(value: unknown): value is WalletId {
  return typeof value === "string" && (WALLET_IDS as readonly string[]).includes(value);
}

export function walletAccountOf(wallet: WalletId): string {
  return WALLET_ACCOUNT[wallet];
}

export function accountName(account: Account, lang: "ar" | "en"): string {
  return lang === "ar" ? account.nameAr : account.nameEn;
}

/** Signed balance for an account type given raw (debit − credit) net. */
export function applySign(type: AccountType, rawNet: number): number {
  const signed = type === "asset" || type === "expense" ? rawNet : -rawNet;
  return signed === 0 ? 0 : signed; // normalize -0 → 0
}

/**
 * The fixed chart of accounts. Seeded locally on every device (idempotently).
 * Step 2+ accounts are included from day one so the chart stays stable;
 * distributor receivable accounts are created dynamically via `account_upsert` events.
 */
export function seedAccounts(): Account[] {
  return [
    // Assets
    { id: "cash_drawer", code: "1000", type: "asset", nameAr: "الخزينة (نقدية)", nameEn: "Cash in drawer" },
    { id: "wallet_vodafone", code: "1101", type: "asset", nameAr: "فودافون كاش", nameEn: "Vodafone Cash" },
    { id: "wallet_orange", code: "1102", type: "asset", nameAr: "أورانج موني", nameEn: "Orange Money" },
    { id: "wallet_eand", code: "1103", type: "asset", nameAr: "e& موني", nameEn: "E& Money" },
    { id: "wallet_instapay", code: "1104", type: "asset", nameAr: "إنستاباي", nameEn: "InstaPay" },
    { id: "basata_float", code: "1200", type: "asset", nameAr: "رصيد باصاتة", nameEn: "BASATA float" },
    { id: "inventory", code: "1300", type: "asset", nameAr: "المخزون", nameEn: "Inventory" },
    // Equity
    { id: "opening_balance", code: "3000", type: "equity", nameAr: "رصيد افتتاحي", nameEn: "Opening balance" },
    // Income
    { id: "fees_income", code: "4000", type: "income", nameAr: "إيراد رسوم المحافظ", nameEn: "Wallet fee income" },
    { id: "sales_revenue", code: "4100", type: "income", nameAr: "إيراد المبيعات", nameEn: "Sales revenue" },
    { id: "basata_margin", code: "4200", type: "income", nameAr: "هامش باصاتة", nameEn: "BASATA margin" },
    { id: "drawer_surplus", code: "4300", type: "income", nameAr: "زيادة الخزينة", nameEn: "Drawer surplus" },
    // Expenses
    { id: "cogs", code: "5000", type: "expense", nameAr: "تكلفة البضاعة", nameEn: "Cost of goods sold" },
    { id: "drawer_shortage", code: "5100", type: "expense", nameAr: "عجز الخزينة", nameEn: "Drawer shortage" },
    { id: "store_expenses", code: "5200", type: "expense", nameAr: "مصروفات المتجر", nameEn: "Store expenses" },
  ];
}
