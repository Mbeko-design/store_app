import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  CASH_ACCOUNT,
  WALLET_ACCOUNT,
  WALLET_IDS,
  WALLET_NAMES,
  buildOperation,
  cashInForSend,
  cashOutForReceive,
  parseEgpInput,
  walletAfter,
  type OperationInput,
  type WalletId,
} from "@mizan/core";
import { useLang } from "../i18n/lang";
import { addEntry, loadBalances, reverseEntry } from "../db/repo";
import { getDeviceId } from "../lib/token";
import { useToast } from "../lib/toast";
import { Icon, type IconName } from "../components/Icon";
import type { TranslationKey } from "../i18n/strings";

type Mode = OperationInput["kind"];

const MODES: Array<{ id: Mode; labelKey: TranslationKey; icon: IconName }> = [
  { id: "wallet_send", labelKey: "op_send", icon: "arrow-up" },
  { id: "wallet_receive", labelKey: "op_receive", icon: "arrow-down" },
  { id: "wallet_deposit", labelKey: "op_deposit", icon: "wallet" },
  { id: "wallet_withdraw", labelKey: "op_withdraw", icon: "wallet" },
  { id: "opening", labelKey: "op_opening", icon: "plus" },
];

const HAS_FEE: ReadonlySet<Mode> = new Set<Mode>(["wallet_send", "wallet_receive"]);

type OpeningTarget = "cash" | WalletId;

export default function NewTransactionScreen() {
  const { t, money } = useLang();
  const toast = useToast();
  const deviceId = useMemo(() => getDeviceId(), []);

  const snapshot = useLiveQuery(() => loadBalances(), []);

  const [mode, setMode] = useState<Mode>("wallet_send");
  const [wallet, setWallet] = useState<WalletId | null>(null);
  const [openingTarget, setOpeningTarget] = useState<OpeningTarget>("cash");
  const [amountText, setAmountText] = useState("");
  const [feeText, setFeeText] = useState("");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [ref, setRef] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmNegative, setConfirmNegative] = useState(false);
  const [saving, setSaving] = useState(false);

  const isWalletOp = mode !== "opening";
  const feeRow = HAS_FEE.has(mode);

  const amount = parseEgpInput(amountText);
  const fee = feeRow ? parseEgpInput(feeText) ?? 0 : 0;
  const amountValid = amount !== null && amount > 0;
  const feeValid = fee >= 0 && (feeText.trim() === "" || parseEgpInput(feeText) !== null);

  const cash = snapshot?.balances[CASH_ACCOUNT] ?? 0;
  const activeWallet: WalletId | null = isWalletOp ? wallet : openingTarget !== "cash" ? openingTarget : null;
  const float = activeWallet ? snapshot?.balances[WALLET_ACCOUNT[activeWallet]] ?? 0 : 0;

  // Projected balances after the operation
  let floatAfter = float;
  let cashAfter = cash;
  if (isWalletOp && amountValid && activeWallet) {
    floatAfter = walletAfter(mode, float, amount, fee);
    const delta =
      mode === "wallet_send"
        ? amount + fee
        : mode === "wallet_receive"
          ? -(amount - fee)
          : mode === "wallet_deposit"
            ? -amount
            : amount;
    cashAfter = cash + delta;
  } else if (mode === "opening" && amountValid) {
    if (openingTarget === "cash") cashAfter = cash + amount;
    else floatAfter = float + amount;
  }

  const floatGoesNegative =
    isWalletOp && amountValid && (mode === "wallet_send" || mode === "wallet_withdraw") && floatAfter < 0;
  const cashGoesNegative =
    isWalletOp && amountValid && (mode === "wallet_receive" || mode === "wallet_deposit") && cashAfter < 0;
  const needsConfirm = floatGoesNegative || cashGoesNegative;

  // Changing inputs re-arms the confirmation
  useEffect(() => {
    setConfirmNegative(false);
  }, [mode, wallet, openingTarget, amountText, feeText]);

  function resetAmounts() {
    setAmountText("");
    setFeeText("");
    setNote("");
    setRef("");
    setConfirmNegative(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (isWalletOp && !wallet) {
      toast.show(t("op_select_wallet"), { tone: "error" });
      return;
    }
    if (!amountValid) {
      toast.show(t("op_enter_amount"), { tone: "error" });
      return;
    }
    if (!feeValid) {
      toast.show(t("op_enter_amount"), { tone: "error" });
      return;
    }
    if (mode === "wallet_receive" && fee > amount) {
      toast.show(t("op_enter_amount"), { tone: "error" });
      return;
    }
    if (needsConfirm && !confirmNegative) {
      setConfirmNegative(true);
      return;
    }

    setSaving(true);
    try {
      const entry = buildOperation({
        kind: mode,
        wallet: isWalletOp && wallet ? wallet : undefined,
        accountId: mode === "opening" ? (openingTarget === "cash" ? CASH_ACCOUNT : WALLET_ACCOUNT[openingTarget]) : undefined,
        amount,
        fee,
        customer,
        phone,
        note,
        ref,
        deviceId,
      });
      await addEntry(entry);
      resetAmounts();
      toast.show(t("op_saved"), {
        action: {
          label: t("op_undo"),
          onClick: async () => {
            try {
              await reverseEntry(entry.id, deviceId);
              toast.show(t("op_undone"));
            } catch {
              toast.show(t("auth_error_generic"), { tone: "error" });
            }
          },
        },
      });
    } catch (err) {
      console.error("failed to save entry", err);
      toast.show(t("auth_error_generic"), { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const showFloatLine = (isWalletOp && activeWallet !== null) || (mode === "opening" && openingTarget !== "cash");
  const showCashLine = isWalletOp || mode === "opening";

  return (
    <div className="p-4">
      <h2 className="mb-3 px-1 text-lg font-bold text-slate-800">{t("op_title")}</h2>

      {/* Mode selector */}
      <div className="mb-4 grid grid-cols-5 gap-1 rounded-2xl bg-white p-1.5 shadow-sm">
        {MODES.map(({ id, labelKey, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`flex flex-col items-center gap-1 rounded-xl px-0.5 py-2.5 text-[10px] font-semibold transition-colors ${
              mode === id ? "bg-teal-700 text-white shadow" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <Icon name={icon} className="h-4.5 w-4.5" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* Account picker */}
        {isWalletOp ? (
          <div>
            <div className="mb-1.5 px-1 text-sm font-medium text-slate-600">{t("op_wallet")}</div>
            <div className="grid grid-cols-2 gap-2">
              {WALLET_IDS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWallet(w)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                    wallet === w
                      ? "border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-600/30"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {WALLET_NAMES[w].ar}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-1.5 px-1 text-sm font-medium text-slate-600">{t("op_wallet")}</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOpeningTarget("cash")}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                  openingTarget === "cash"
                    ? "border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-600/30"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {t("dash_cash")}
              </button>
              {WALLET_IDS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setOpeningTarget(w)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                    openingTarget === w
                      ? "border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-600/30"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {WALLET_NAMES[w].ar}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Amount + fee */}
        <div className={`grid gap-3 ${feeRow ? "grid-cols-2" : "grid-cols-1"}`}>
          <label className="block rounded-2xl border border-slate-200 bg-white p-3">
            <span className="text-xs font-medium text-slate-500">{t("op_amount")}</span>
            <div className="flex items-baseline gap-1">
              <input
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="0.00"
                className="w-full border-0 bg-transparent text-2xl font-bold text-slate-900 outline-none placeholder:text-slate-300"
              />
              <span className="text-sm text-slate-400">EGP</span>
            </div>
          </label>
          {feeRow && (
            <label className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="text-xs font-medium text-slate-500">{t("op_fee_hint")}</span>
              <div className="flex items-baseline gap-1">
                <input
                  inputMode="decimal"
                  value={feeText}
                  onChange={(e) => setFeeText(e.target.value)}
                  placeholder="0.00"
                  className="w-full border-0 bg-transparent text-2xl font-bold text-teal-800 outline-none placeholder:text-slate-300"
                />
                <span className="text-sm text-slate-400">EGP</span>
              </div>
            </label>
          )}
        </div>

        {/* Preview */}
        {amountValid && (
          <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
            <PreviewLine
              label={
                mode === "wallet_send"
                  ? t("op_customer_pays")
                  : mode === "wallet_receive"
                    ? t("op_wallet_received")
                    : mode === "wallet_deposit"
                      ? t("op_from_cash")
                      : mode === "wallet_withdraw"
                        ? t("op_to_cash")
                        : t("op_opening_add")
              }
              value={
                mode === "wallet_send"
                  ? cashInForSend(amount, fee)
                  : mode === "wallet_receive"
                    ? amount
                    : amount
              }
              money={money}
            />
            {mode === "wallet_send" && <PreviewLine label={t("op_sends_to")} value={amount} money={money} />}
            {mode === "wallet_receive" && <PreviewLine label={t("op_cash_to_customer")} value={cashOutForReceive(amount, fee)} money={money} />}
            {showFloatLine && (
              <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="text-xs text-slate-500">{t("op_float_after")}</span>
                <span className={`font-bold ${floatAfter < 0 ? "text-red-600" : "text-slate-900"}`} dir="rtl">
                  {money(floatAfter)}
                </span>
              </div>
            )}
            {showCashLine && (
              <div className={`flex items-center justify-between ${showFloatLine ? "" : "border-t border-slate-100 pt-2"}`}>
                <span className="text-xs text-slate-500">{t("op_cash_after")}</span>
                <span className={`font-bold ${cashAfter < 0 ? "text-red-600" : "text-slate-900"}`} dir="rtl">
                  {money(cashAfter)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Negative warnings */}
        {needsConfirm && (
          <div
            className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${
              floatGoesNegative ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
            }`}
            role="alert"
          >
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {floatGoesNegative ? t("op_negative_float") : t("op_insufficient_cash")}
              {!confirmNegative && ` — ${t("op_confirm")}`}
            </span>
          </div>
        )}

        {/* Optional details */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-600"
          >
            {t("op_details")}
            <Icon name="chevron-left" className={`h-4 w-4 transition-transform ${detailsOpen ? "-rotate-90" : ""}`} />
          </button>
          {detailsOpen && (
            <div className="space-y-3 border-t border-slate-100 p-4">
              <DetailInput label={t("op_customer")} value={customer} onChange={setCustomer} />
              <DetailInput label={t("op_phone")} value={phone} onChange={setPhone} inputMode="tel" />
              <DetailInput label={t("op_note")} value={note} onChange={setNote} />
              <DetailInput label={t("op_ref")} value={ref} onChange={setRef} />
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || (isWalletOp && !wallet) || !amountValid || !feeValid}
          className={`w-full rounded-xl py-3.5 font-bold text-white transition-colors disabled:opacity-50 ${
            confirmNegative && needsConfirm ? "bg-red-600 hover:bg-red-700" : "bg-teal-700 hover:bg-teal-800"
          }`}
        >
          {confirmNegative && needsConfirm ? t("op_confirm") : t("op_save")}
        </button>
      </form>
    </div>
  );
}

function PreviewLine({ label, value, money }: { label: string; value: number; money: (p: number) => string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="font-bold text-slate-900" dir="rtl">
        {money(value)}
      </span>
    </div>
  );
}

function DetailInput({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "tel";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
      />
    </label>
  );
}
