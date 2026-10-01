import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  WALLET_ACCOUNT,
  WALLET_IDS,
  WALLET_NAMES,
  accountName,
  applySign,
  entryTotals,
  isWalletId,
  type Account,
  type JournalEntry,
} from "@mizan/core";
import { useLang } from "../i18n/lang";
import { isToday, loadBalances, reverseEntry, sortDesc } from "../db/repo";
import { db } from "../db/schema";
import { getDeviceId } from "../lib/token";
import { useToast } from "../lib/toast";
import { Icon } from "../components/Icon";
import type { TranslationKey } from "../i18n/strings";

interface Props {
  accountId: string | null;
  setAccountId: (id: string | null) => void;
}

type Scope = "today" | "all";

export default function LedgerScreen({ accountId, setAccountId }: Props) {
  const { t, money, lang } = useLang();
  const toast = useToast();
  const [scope, setScope] = useState<Scope>("today");
  const [selected, setSelected] = useState<JournalEntry | null>(null);

  const accounts = useLiveQuery(() => db.accounts.toArray(), [], [] as Account[]);
  const entries = useLiveQuery(() => db.entries.toArray().then(sortDesc), [], [] as JournalEntry[]);
  const snapshot = useLiveQuery(() => loadBalances(), []);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const selectedAccount = accountId ? accountMap.get(accountId) ?? null : null;

  const reversedIds = useMemo(
    () => new Set(entries.filter((e) => e.kind === "reversal" && e.meta.reverses).map((e) => e.meta.reverses as string)),
    [entries],
  );

  // Running balance for the selected account (all-time, ascending)
  const runningByEntry = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedAccount) return map;
    let balance = 0;
    const asc = [...entries].reverse();
    for (const entry of asc) {
      let delta = 0;
      for (const p of entry.postings) {
        if (p.accountId === selectedAccount.id) delta += applySign(selectedAccount.type, p.debit - p.credit);
      }
      balance += delta;
      map.set(entry.id, balance);
    }
    return map;
  }, [entries, selectedAccount]);

  const visible = entries.filter((e) => {
    if (scope === "today" && !isToday(e.occurredAt)) return false;
    if (accountId && !e.postings.some((p) => p.accountId === accountId)) return false;
    return true;
  });

  const currentBalance = accountId && snapshot ? (snapshot.balances[accountId] ?? 0) : 0;

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-lg font-bold text-slate-800">{t("ledger_title")}</h2>
        <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
          {(["today", "all"] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                scope === s ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {s === "today" ? t("ledger_scope_today") : t("ledger_scope_all")}
            </button>
          ))}
        </div>
      </div>

      {/* Account filter */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <FilterChip active={accountId === null} onClick={() => setAccountId(null)} label={t("ledger_all_accounts")} />
        <FilterChip
          active={accountId === "cash_drawer"}
          onClick={() => setAccountId("cash_drawer")}
          label={t("dash_cash")}
        />
        {WALLET_IDS.map((w) => (
          <FilterChip
            key={w}
            active={accountId === WALLET_ACCOUNT[w]}
            onClick={() => setAccountId(WALLET_ACCOUNT[w])}
            label={WALLET_NAMES[w].ar}
          />
        ))}
      </div>

      {/* Current balance for selected account */}
      {selectedAccount && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-white px-4 py-2.5 shadow-sm">
          <span className="text-sm text-slate-500">
            {accountName(selectedAccount, lang)} — {t("ledger_balance")}
          </span>
          <span className={`font-bold ${currentBalance < 0 ? "text-red-600" : "text-teal-800"}`} dir="rtl">
            {money(currentBalance)}
          </span>
        </div>
      )}

      {/* Entries */}
      {visible.length === 0 ? (
        <p className="mt-10 text-center text-sm text-slate-400">{t("ledger_empty")}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((entry) => {
            const isReversed = reversedIds.has(entry.id);
            const wallet = isWalletId(entry.meta.wallet) ? entry.meta.wallet : null;
            const kindLabelKey = `kind_${entry.kind}` as TranslationKey;
            const visual = kindVisual(entry.kind);
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setSelected(entry)}
                  className={`w-full rounded-2xl border bg-white p-3.5 text-start shadow-sm transition-colors hover:border-teal-400 ${
                    isReversed ? "border-slate-200 opacity-60" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${visual.cls}`}
                      >
                        <Icon name={visual.icon} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-slate-800">{t(kindLabelKey)}</span>
                          {wallet && <span className="text-[10px] text-slate-400">· {WALLET_NAMES[wallet].ar}</span>}
                          {isReversed && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                              {t("ledger_reversed")}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-slate-400">
                          {formatWhen(entry.occurredAt, scope, lang)}
                          {entry.meta.customer ? ` · ${entry.meta.customer}` : ""}
                          {entry.meta.note ? ` · ${entry.meta.note}` : ""}
                        </div>
                      </div>
                    </div>

                    {/* Amount column */}
                    <div className="shrink-0 text-end">
                      {selectedAccount ? (
                        <EntryDelta entry={entry} account={selectedAccount} money={money} />
                      ) : (
                        <CompactPostings entry={entry} accounts={accountMap} money={money} t={t} />
                      )}
                    </div>
                  </div>

                  {selectedAccount && runningByEntry.has(entry.id) && (
                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[11px] text-slate-400">
                      <span>{t("ledger_balance")}</span>
                      <span dir="rtl">{money(runningByEntry.get(entry.id)!)}</span>
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Detail modal */}
      {selected && (
        <EntryModal
          entry={selected}
          reversed={reversedIds.has(selected.id)}
          accounts={accountMap}
          onClose={() => setSelected(null)}
          onReversed={() => {
            setSelected(null);
            toast.show(t("op_undone"));
          }}
        />
      )}
    </div>
  );
}

function kindVisual(kind: JournalEntry["kind"]): { icon: "refresh" | "arrow-up" | "arrow-down"; cls: string } {
  if (kind === "reversal") return { icon: "refresh", cls: "bg-slate-100 text-slate-500" };
  if (kind === "wallet_send" || kind === "wallet_withdraw") return { icon: "arrow-up", cls: "bg-amber-100 text-amber-700" };
  return { icon: "arrow-down", cls: "bg-teal-100 text-teal-700" }; // receive, deposit, opening = money in
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-teal-700 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-teal-400"
      }`}
    >
      {label}
    </button>
  );
}

function EntryDelta({ entry, account, money }: { entry: JournalEntry; account: Account; money: (p: number) => string }) {
  let delta = 0;
  for (const p of entry.postings) {
    if (p.accountId === account.id) delta += applySign(account.type, p.debit - p.credit);
  }
  const positive = delta >= 0;
  return (
    <span className={`text-sm font-bold ${positive ? "text-emerald-600" : "text-red-600"}`} dir="rtl">
      {positive ? "+" : "−"}
      {money(Math.abs(delta))}
    </span>
  );
}

function CompactPostings({
  entry,
  accounts,
  money,
  t,
}: {
  entry: JournalEntry;
  accounts: Map<string, Account>;
  money: (p: number) => string;
  t: (key: TranslationKey) => string;
}) {
  const { debits, credits } = entryTotals(entry);
  if (entry.meta.amount !== undefined && debits === credits) {
    // Show the headline amount (wallet movement) plus fee if present
    return (
      <div>
        <span className="text-sm font-bold text-slate-800" dir="rtl">
          {money(entry.meta.amount)}
        </span>
        {(entry.meta.fee ?? 0) > 0 && <div className="text-[10px] text-teal-700">+ {money(entry.meta.fee!)} {t("op_fee")}</div>}
      </div>
    );
  }
  return (
    <div className="text-end">
      {entry.postings.slice(0, 2).map((p, i) => {
        const account = accounts.get(p.accountId);
        const delta = account ? applySign(account.type, p.debit - p.credit) : p.debit - p.credit;
        return (
          <div key={i} className={`text-xs ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`} dir="rtl">
            {delta >= 0 ? "+" : "−"}
            {money(Math.abs(delta))}
          </div>
        );
      })}
    </div>
  );
}

function EntryModal({
  entry,
  reversed,
  accounts,
  onClose,
  onReversed,
}: {
  entry: JournalEntry;
  reversed: boolean;
  accounts: Map<string, Account>;
  onClose: () => void;
  onReversed: () => void;
}) {
  const { t, money, lang } = useLang();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const canReverse = entry.kind !== "reversal" && !reversed;
  const wallet = isWalletId(entry.meta.wallet) ? entry.meta.wallet : null;

  async function doReverse() {
    if (busy) return;
    setBusy(true);
    try {
      await reverseEntry(entry.id, getDeviceId());
      onReversed();
    } catch (err) {
      console.error(err);
      toast.show(t("auth_error_generic"), { tone: "error" });
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">{t("ledger_entry_details")}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label={t("common_close")}>
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1 text-sm">
          <ModalRow label={t("ledger_time")} value={new Date(entry.occurredAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-EG")} />
          <ModalRow label={t("ledger_kind")} value={t(`kind_${entry.kind}` as TranslationKey)} />
          {wallet && <ModalRow label={t("op_wallet")} value={WALLET_NAMES[wallet][lang]} />}
          {entry.meta.customer && <ModalRow label={t("op_customer")} value={entry.meta.customer} />}
          {entry.meta.phone && <ModalRow label={t("op_phone")} value={entry.meta.phone} />}
          {entry.meta.note && <ModalRow label={t("op_note")} value={entry.meta.note} />}
          {entry.meta.ref && <ModalRow label={t("op_ref")} value={entry.meta.ref} />}
          {entry.meta.reverses && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{t("ledger_reverses")}</div>
          )}
          {reversed && <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">{t("ledger_reversed")}</div>}
        </div>

        {/* Postings */}
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-400">
              <th className="py-1.5 text-start font-medium">{t("ledger_filter_account")}</th>
              <th className="py-1.5 text-end font-medium">{t("ledger_in")}</th>
              <th className="py-1.5 text-end font-medium">{t("ledger_out")}</th>
            </tr>
          </thead>
          <tbody>
            {entry.postings.map((p, i) => {
              const account = accounts.get(p.accountId);
              return (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 text-start text-slate-700">{account ? accountName(account, lang) : p.accountId}</td>
                  <td className="py-2 text-end font-semibold text-emerald-600" dir="rtl">
                    {p.debit > 0 ? money(p.debit) : "—"}
                  </td>
                  <td className="py-2 text-end font-semibold text-red-600" dir="rtl">
                    {p.credit > 0 ? `−${money(p.credit)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {canReverse && (
          <button
            type="button"
            onClick={() => (confirming ? void doReverse() : setConfirming(true))}
            disabled={busy}
            className={`mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
              confirming ? "bg-red-600 text-white hover:bg-red-700" : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            {confirming ? t("ledger_reverse_confirm") : t("ledger_reverse")}
          </button>
        )}

        <button type="button" onClick={onClose} className="mt-2 w-full rounded-xl py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50">
          {t("common_close")}
        </button>
      </div>
    </div>
  );
}

function ModalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="text-end font-medium text-slate-800">{value}</span>
    </div>
  );
}

function formatWhen(iso: string, scope: Scope, lang: "ar" | "en"): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-EG", { hour: "2-digit", minute: "2-digit" });
  if (scope === "today") return time;
  return `${date.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-EG", { day: "numeric", month: "short" })} · ${time}`;
}
