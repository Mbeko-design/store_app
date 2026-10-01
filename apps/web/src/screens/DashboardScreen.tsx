import { useLiveQuery } from "dexie-react-hooks";
import { CASH_ACCOUNT, WALLET_ACCOUNT, WALLET_IDS, WALLET_NAMES, type JournalEntry } from "@mizan/core";
import { useLang } from "../i18n/lang";
import { isToday, loadBalances, sortDesc } from "../db/repo";
import { db } from "../db/schema";
import { Icon } from "../components/Icon";

interface Props {
  onOpenWallet: (accountId: string) => void;
  onNewOperation: () => void;
}

export default function DashboardScreen({ onOpenWallet, onNewOperation }: Props) {
  const { t, money } = useLang();

  const snapshot = useLiveQuery(() => loadBalances(), []);
  const entries = useLiveQuery(() => db.entries.toArray().then(sortDesc), [], [] as JournalEntry[]);

  if (!snapshot) {
    return <p className="p-6 text-center text-sm text-slate-400">{t("common_loading")}</p>;
  }

  const { balances } = snapshot;

  // Today's active operations (reversals and reversed entries excluded from stats)
  const reversedIds = new Set(
    entries.filter((e) => e.kind === "reversal" && e.meta.reverses).map((e) => e.meta.reverses as string),
  );
  const active = entries.filter((e) => e.kind !== "reversal" && !reversedIds.has(e.id) && isToday(e.occurredAt));
  const feesToday = active.reduce((s, e) => s + (e.meta.fee ?? 0), 0);
  const sentToday = active.filter((e) => e.kind === "wallet_send").reduce((s, e) => s + (e.meta.amount ?? 0), 0);
  const receivedToday = active.filter((e) => e.kind === "wallet_receive").reduce((s, e) => s + (e.meta.amount ?? 0), 0);
  const txCount = active.length;
  const cash = balances[CASH_ACCOUNT] ?? 0;

  return (
    <div className="space-y-5 p-4">
      <h2 className="px-1 text-lg font-bold text-slate-800">{t("dash_title")}</h2>

      {/* Cash drawer */}
      <section className="rounded-2xl bg-gradient-to-br from-teal-700 to-teal-900 p-5 text-white shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-sm text-teal-100">{t("dash_cash")}</span>
          <Icon name="wallet" className="h-5 w-5 text-teal-200" />
        </div>
        <div className={`mt-1 text-3xl font-bold ${cash < 0 ? "text-red-200" : ""}`} dir="rtl">
          {money(cash)}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-teal-500/40 pt-3 text-center text-[11px] text-teal-100">
          <div>
            <div className="text-[10px] uppercase opacity-80">{t("dash_fees_today")}</div>
            <div className="mt-0.5 text-sm font-semibold text-white">{money(feesToday)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase opacity-80">{t("dash_sent_today")}</div>
            <div className="mt-0.5 text-sm font-semibold text-white">{money(sentToday)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase opacity-80">{t("dash_received_today")}</div>
            <div className="mt-0.5 text-sm font-semibold text-white">{money(receivedToday)}</div>
          </div>
        </div>
      </section>

      {/* Wallets */}
      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-bold text-slate-700">{t("dash_wallets")}</h2>
          <span className="text-[11px] text-slate-400">{t("dash_tap_wallet")}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {WALLET_IDS.map((wallet) => {
            const accountId = WALLET_ACCOUNT[wallet];
            const balance = balances[accountId] ?? 0;
            const todayCount = active.filter((e) => e.meta.wallet === wallet).length;
            return (
              <button
                key={wallet}
                type="button"
                onClick={() => onOpenWallet(accountId)}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-sm transition-all hover:border-teal-400 hover:shadow"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{WALLET_NAMES[wallet].ar}</span>
                  <Icon name="wallet" className="h-4 w-4 text-slate-300" />
                </div>
                <div className={`mt-1.5 text-lg font-bold ${balance < 0 ? "text-red-600" : "text-slate-900"}`} dir="rtl">
                  {money(balance)}
                </div>
                {todayCount > 0 && (
                  <div className="mt-1 text-[10px] text-teal-700">
                    {todayCount} {t("dash_tx_today")}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Empty state / CTA */}
      {entries.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">{t("dash_no_activity")}</p>
          <button
            type="button"
            onClick={onNewOperation}
            className="mt-4 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            {t("op_title")}
          </button>
        </section>
      ) : null}
    </div>
  );
}
