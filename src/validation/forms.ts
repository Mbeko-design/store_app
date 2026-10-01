import { CASH_ACCOUNT_ID, OPERATION_TYPES, type Account, type OperationType } from "../accounting/types";
import { parseAmountInput } from "./money";
import { normalizePhone, validatePhone } from "./phone";

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

/* ---------------- account form ---------------- */

export interface AccountFormInput {
  phone: string;
  label: string;
  limitEgp: string;
  openingEgp: string;
}

export type AccountFormField = "phone" | "label" | "limitEgp" | "openingEgp";

/** Validate an account create/edit form. `existing` is used for duplicate detection. */
export function validateAccountForm(
  input: AccountFormInput,
  existing: readonly Account[],
  currentId?: string,
): { errors: FieldErrors<AccountFormField>; values: { phone: string; limitPiastres: number; openingPiastres: number; label: string } | null } {
  const errors: FieldErrors<AccountFormField> = {};

  const phoneError = validatePhone(input.phone);
  const phone = normalizePhone(input.phone.trim());
  if (phoneError) {
    errors.phone = phoneError;
  } else {
    const dup = existing.find((a) => a.phone === phone && a.id !== currentId);
    if (dup) errors.phone = "رقم الهاتف مسجل بالفعل في حساب آخر";
  }

  if (input.label.trim().length > 40) errors.label = "الاسم طويل جدًا (40 حرفًا كحد أقصى)";

  let limitPiastres = 0;
  const limit = parseAmountInput(input.limitEgp);
  if (!limit.ok) errors.limitEgp = limit.error;
  else limitPiastres = limit.piastres;

  let openingPiastres = 0;
  const openingRaw = input.openingEgp.trim();
  if (openingRaw.startsWith("-")) {
    errors.openingEgp = "الرصيد الافتتاحي لا يمكن أن يكون سالبًا";
  } else if (!openingRaw) {
    openingPiastres = 0; // optional field, defaults to 0
  } else {
    const opening = parseAmountInput(openingRaw);
    if (!opening.ok) errors.openingEgp = opening.error;
    else openingPiastres = opening.piastres;
  }

  const ok = Object.keys(errors).length === 0;
  return {
    errors,
    values: ok ? { phone, limitPiastres, openingPiastres, label: input.label.trim() } : null,
  };
}

/* ---------------- operation form ---------------- */

export interface OperationFormInput {
  type: OperationType | "";
  /** Account id or "cash" (the "(Cash) فلوس" pseudo-source). */
  source: string;
  amount: string;
  /** datetime-local value (local time). */
  when: string;
  note: string;
}

export type OperationFormField = "type" | "source" | "amount" | "when" | "note";

export interface ValidOperation {
  type: OperationType;
  accountId: string;
  amountPiastres: number;
  occurredAtIso: string;
  note: string;
}

export function validateOperationForm(
  input: OperationFormInput,
  accounts: readonly Account[],
): { errors: FieldErrors<OperationFormField>; value: ValidOperation | null } {
  const errors: FieldErrors<OperationFormField> = {};

  // type
  let type: OperationType | null = null;
  if (!input.type || !OPERATION_TYPES.includes(input.type as OperationType)) {
    errors.type = "اختر نوع العملية";
  } else {
    type = input.type as OperationType;
  }

  // source / account
  const activeAccounts = accounts.filter((a) => !a.archivedAtIso);
  let accountId = "";
  const source = input.source;
  if (!source) {
    errors.source = "اختر المصدر";
  } else if (source === CASH_ACCOUNT_ID) {
    if (type === "withdraw" || type === "deposit") {
      // سحب/إيداع must target a real Vodafone account — cash cannot be their source.
      errors.source = "هذه العملية تحتاج حساب فيودافون كاش (المصدر (Cash) فلوس غير صالح)";
    } else {
      accountId = CASH_ACCOUNT_ID;
    }
  } else {
    const acc = accounts.find((a) => a.id === source);
    if (!acc) errors.source = "الحساب المحدد غير موجود";
    else if (acc.archivedAtIso) errors.source = "لا يمكن إضافة عمليات على حساب مؤرشف";
    else accountId = acc.id;
  }

  // amount
  const amount = parseAmountInput(input.amount);
  if (!amount.ok) errors.amount = amount.error;
  // date & time
  const whenMs = Date.parse(input.when);
  if (!input.when || Number.isNaN(whenMs)) {
    errors.when = "التاريخ والوقت مطلوبان";
  }

  // note (optional)
  const note = input.note.trim();
  if (note.length > 120) errors.note = "الملاحظة طويلة جدًا (120 حرفًا كحد أقصى)";

  const ok = Object.keys(errors).length === 0;
  const occurredAtIso = Number.isNaN(whenMs) ? "" : new Date(whenMs).toISOString();
  return {
    errors,
    value:
      ok && type && amount.ok
        ? {
            type,
            accountId: accountId || (source === CASH_ACCOUNT_ID ? CASH_ACCOUNT_ID : ""),
            amountPiastres: amount.piastres,
            occurredAtIso,
            note,
          }
        : null,
  };
}
