import { DEFAULT_MONTHLY_LIMIT_PIASTRES } from "../accounting/limit";
import type { Account } from "../accounting/types";
import { newId } from "../utils/labels";
import { normalizePhone } from "../validation/phone";
import { allAccounts, db } from "./db";

export interface CreateAccountInput {
  phone: string;
  label?: string;
  limitMonthlyPiastres: number;
  openingBalancePiastres: number;
}

export interface UpdateAccountInput {
  phone?: string;
  label?: string;
  limitMonthlyPiastres?: number;
  /** Opening balance is an editable input — changing it shifts the derived balance. */
  openingBalancePiastres?: number;
}

async function assertPhoneUnique(phone: string, currentId?: string): Promise<void> {
  const normalized = normalizePhone(phone);
  const all = await db.accounts.toArray();
  if (all.some((a) => a.phone === normalized && a.id !== currentId)) {
    throw new Error("duplicate_phone");
  }
}

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const phone = normalizePhone(input.phone);
  await assertPhoneUnique(phone);
  const account: Account = {
    id: newId(),
    phone,
    label: input.label?.trim() || undefined,
    limitMonthlyPiastres: input.limitMonthlyPiastres || DEFAULT_MONTHLY_LIMIT_PIASTRES,
    openingBalancePiastres: input.openingBalancePiastres,
    createdAtIso: new Date().toISOString(),
    archivedAtIso: null,
  };
  await db.accounts.put(account);
  return account;
}

export async function updateAccount(id: string, patch: UpdateAccountInput): Promise<Account> {
  const existing = await db.accounts.get(id);
  if (!existing) throw new Error("not_found");
  if (patch.phone !== undefined) await assertPhoneUnique(patch.phone, id);
  const updated: Account = {
    ...existing,
    ...(patch.phone !== undefined ? { phone: normalizePhone(patch.phone) } : {}),
    ...(patch.label !== undefined ? { label: patch.label.trim() || undefined } : {}),
    ...(patch.limitMonthlyPiastres !== undefined ? { limitMonthlyPiastres: patch.limitMonthlyPiastres } : {}),
    ...(patch.openingBalancePiastres !== undefined ? { openingBalancePiastres: patch.openingBalancePiastres } : {}),
  };
  await db.accounts.put(updated);
  return updated;
}

export async function archiveAccount(id: string): Promise<void> {
  await db.accounts.update(id, { archivedAtIso: new Date().toISOString() });
}

export async function restoreAccount(id: string): Promise<void> {
  await db.accounts.update(id, { archivedAtIso: null });
}

export { allAccounts };
