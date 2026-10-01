import { useEffect, useState } from "react";
import { DEFAULT_MONTHLY_LIMIT_PIASTRES } from "../accounting/limit";
import type { Account } from "../accounting/types";
import { createAccount, updateAccount } from "../services/accountsService";
import { useAccounts } from "../hooks/useData";
import { validateAccountForm, type FieldErrors, type AccountFormField } from "../validation/forms";
import { piastresToEgp } from "../utils/money";
import { useToast } from "./Toast";
import { Button } from "./Button";
import { Field, inputCls } from "./Field";
import { AmountInput } from "./AmountInput";

/**
 * Create / edit account dialog (phone, label, monthly limit, editable opening balance).
 * Used on the Accounts page and the account details header (edit icon).
 */
export function AccountFormDialog({
  open,
  account,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** undefined → create mode; otherwise edit mode. */
  account?: Account;
  onClose: () => void;
  onSaved?: (saved: Account) => void;
}) {
  const all = useAccounts(true) ?? [];
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [limitEgp, setLimitEgp] = useState("");
  const [openingEgp, setOpeningEgp] = useState("");
  const [errors, setErrors] = useState<FieldErrors<AccountFormField>>({});
  const [saving, setSaving] = useState(false);

  // (Re)initialize when opened.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSaving(false);
    setPhone(account?.phone ?? "");
    setLabel(account?.label ?? "");
    setLimitEgp(String(piastresToEgp(account?.limitMonthlyPiastres ?? DEFAULT_MONTHLY_LIMIT_PIASTRES)));
    setOpeningEgp(account ? String(piastresToEgp(account.openingBalancePiastres)) : "");
  }, [open, account]);

  if (!open) return null;

  const submit = async () => {
    if (saving) return; // double-submit guard
    const { errors: errs, values } = validateAccountForm({ phone, label, limitEgp, openingEgp }, all, account?.id);
    setErrors(errs);
    if (!values) return;

    setSaving(true);
    try {
      const saved = account
        ? await updateAccount(account.id, {
            phone: values.phone,
            label: values.label,
            limitMonthlyPiastres: values.limitPiastres,
            openingBalancePiastres: values.openingPiastres,
          })
        : await createAccount({
            phone: values.phone,
            label: values.label,
            limitMonthlyPiastres: values.limitPiastres,
            openingBalancePiastres: values.openingPiastres,
          });
      toast.success(account ? "تم تحديث الحساب" : "تمت إضافة الحساب");
      onSaved?.(saved);
      onClose();
    } catch (e) {
      if (e instanceof Error && e.message === "duplicate_phone") {
        setErrors({ phone: "رقم الهاتف مسجل بالفعل في حساب آخر" });
      } else {
        toast.error("تعذر حفظ الحساب");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy/45" onClick={() => !saving && onClose()} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="acc-form-title" className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-lg border border-line bg-card p-5 shadow-pop">
        <div className="flex items-center justify-between">
          <h2 id="acc-form-title" className="text-lg font-extrabold">
            {account ? "تعديل الحساب" : "إضافة حساب"}
          </h2>
          <button type="button" onClick={onClose} disabled={saving} className="grid size-10 place-items-center rounded-md text-ink-3 hover:bg-page" aria-label="إغلاق">
            ×
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="رقم الموبايل" htmlFor="acc-phone" error={errors.phone} required hint="صيغة الحساب: 01XXXXXXXXX">
            <input
              id="acc-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={errors.phone ? true : undefined}
              className={`${inputCls} ${errors.phone ? "border-neg" : ""}`}
              placeholder="01XXXXXXXXX"
            />
          </Field>

          <Field label="اسم الحساب (اختياري)" htmlFor="acc-label" error={errors.label}>
            <input
              id="acc-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
              placeholder="مثال: خزنة المحل"
              className={`${inputCls} ${errors.label ? "border-neg" : ""}`}
            />
          </Field>

          <AmountInput
            label="الليميت الشهري للسحب"
            value={limitEgp}
            onChange={setLimitEgp}
            error={errors.limitEgp}
            hint="يُصفَّر استخدامه أول كل شهر"
          />

          <AmountInput
            label="الرصيد الافتتاحي"
            value={openingEgp}
            onChange={setOpeningEgp}
            error={errors.openingEgp}
            hint="يمكن تعديله في أي وقت — العمليات المسجلة لا تتغير"
          />
        </div>

        <div className="mt-5 flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
          <Button type="button" variant="primary" className="flex-1" onClick={submit} loading={saving}>
            {account ? "حفظ التعديلات" : "إضافة الحساب"}
          </Button>
        </div>
      </div>
    </div>
  );
}
