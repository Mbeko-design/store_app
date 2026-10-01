import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { OPERATION_TYPES, type OperationType } from "../accounting/types";
import { AccountSelect } from "../components/AccountSelect";
import { AmountInput } from "../components/AmountInput";
import { Button } from "../components/Button";
import { DateTimeInput } from "../components/DateTimeInput";
import { EmptyState } from "../components/EmptyState";
import { Field, inputCls } from "../components/Field";
import { Icon } from "../components/Icon";
import { OperationTypeToggle } from "../components/OperationTypeToggle";
import { LoadingBlock } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useAccounts } from "../hooks/useData";
import { addOperation } from "../services/operationsService";
import { nowLocalInputValue } from "../utils/dates";
import { validateOperationForm, type FieldErrors, type OperationFormField } from "../validation/forms";

/**
 * Add operation (screen 5): segmented يدوي/تلقائي (auto = disabled "قريباً"),
 * type toggle, source select, amount, date/time, note → save with inline
 * validation, double-submit protection and success/error toasts.
 * Deep-linkable: /add?type=withdraw&account=<id> (quick actions).
 */
export function AddOperationPage() {
  const [params, setParams] = useSearchParams();
  const accounts = useAccounts(false);
  const toast = useToast();

  const typeParam = params.get("type");
  const accountParam = params.get("account");

  const [type, setType] = useState<OperationType | "">(
    typeParam && OPERATION_TYPES.includes(typeParam as OperationType) ? (typeParam as OperationType) : "",
  );
  const [source, setSource] = useState(accountParam ?? "");
  const [amount, setAmount] = useState("");
  const [when, setWhen] = useState(() => nowLocalInputValue());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors<OperationFormField>>({});
  const [saving, setSaving] = useState(false);

  // Apply deep-link params after mount (quick actions / category buttons).
  useEffect(() => {
    if (typeParam && OPERATION_TYPES.includes(typeParam as OperationType)) setType(typeParam as OperationType);
    if (accountParam) setSource(accountParam);
  }, [typeParam, accountParam]);

  if (!accounts) {
    return (
      <div className="space-y-4">
        <LoadingBlock label="جارٍ التحميل…" />
      </div>
    );
  }

  const changeType = (t: OperationType) => {
    setType(t);
    setErrors((e) => ({ ...e, type: undefined }));
    // سحب/إيداع require a wallet: clear an invalid cash source.
    if (t !== "cash" && source === "cash") setSource("");
    // فلوس defaults to the cash source.
    if (t === "cash" && source === "") setSource("cash");
  };

  const clearParamType = () => {
    if (params.get("type") || params.get("account")) setParams({}, { replace: true });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return; // double-submit guard
    clearParamType();

    const { errors: errs, value } = validateOperationForm({ type, source, amount, when, note }, accounts);
    setErrors(errs);
    if (!value) return;

    setSaving(true);
    try {
      await addOperation({
        accountId: value.accountId,
        type: value.type,
        amountPiastres: value.amountPiastres,
        occurredAtIso: value.occurredAtIso,
        note: value.note,
      });
      toast.success("تم حفظ العملية بنجاح");
      setAmount("");
      setNote("");
      setWhen(nowLocalInputValue());
      setErrors({});
    } catch {
      toast.error("تعذر حفظ العملية");
    } finally {
      setSaving(false);
    }
  };

  const noAccounts = accounts.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Entry mode segmented control */}
      <div className="flex rounded-md border border-line bg-card p-1" role="tablist" aria-label="طريقة الإدخال">
        <button
          type="button"
          role="tab"
          aria-selected="true"
          className="h-10 flex-1 rounded-md bg-navy text-sm font-extrabold text-white"
        >
          يدوي
        </button>
        <button
          type="button"
          role="tab"
          aria-selected="false"
          disabled
          title="قريباً"
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-bold text-ink-3"
          aria-disabled="true"
        >
          تلقائي
          <span className="rounded-full bg-page px-2 py-0.5 text-[10px] font-extrabold">قريباً</span>
        </button>
      </div>

      {noAccounts && (
        <div className="flex items-start gap-3 rounded-md border border-cash-line bg-cash-bg p-4 text-sm text-cash">
          <Icon name="info" size={18} className="mt-0.5 shrink-0" />
          <div>
            لا توجد حسابات بعد — يمكن تسجيل عمليات <strong>فلوس</strong> فقط. لعمليات السحب/الإيداع أضف حسابًا أولًا.
            <div className="mt-2">
              <Link to="/accounts" className="font-extrabold underline underline-offset-2">
                إضافة حساب
              </Link>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submit} noValidate className="space-y-4 rounded-lg border border-line bg-card p-4 shadow-card md:p-5">
        <OperationTypeToggle value={type} onChange={changeType} error={errors.type} />

        <AccountSelect
          accounts={accounts}
          value={source}
          onChange={(v) => {
            setSource(v);
            setErrors((e) => ({ ...e, source: undefined }));
          }}
          error={errors.source}
          allowCash={type === "cash"}
        />

        <AmountInput
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setErrors((e) => ({ ...e, amount: undefined }));
          }}
          error={errors.amount}
        />

        <DateTimeInput
          value={when}
          onChange={(v) => {
            setWhen(v);
            setErrors((e) => ({ ...e, when: undefined }));
          }}
          error={errors.when}
        />

        <Field label="ملاحظة (اختياري)" htmlFor="op-note" error={errors.note}>
          <input
            id="op-note"
            type="text"
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثال: تحصيل من العميل أحمد"
            className={`${inputCls} ${errors.note ? "border-neg" : ""}`}
          />
        </Field>

        <Button type="submit" variant="primary" loading={saving} className="w-full">
          حفظ العملية
        </Button>
        <p className="text-center text-[11px] text-ink-3">
          CASHY دفتر تسجيل شخصي — لا ينفذ أي عملية حقيقية على أي شبكة.
        </p>
      </form>

      <div className="text-center">
        <Link to="/history/withdraw" className="text-sm font-bold text-cash underline underline-offset-2">
          مراجعة سجل العمليات
        </Link>
      </div>
    </div>
  );
}
