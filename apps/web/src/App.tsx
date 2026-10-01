import { useEffect, useState } from "react";
import { useLang } from "./i18n/lang";
import { useAuth } from "./lib/auth";
import { ensureSeeded } from "./db/repo";
import { startSyncEngine } from "./lib/sync";
import AuthScreen from "./screens/AuthScreen";
import DashboardScreen from "./screens/DashboardScreen";
import NewTransactionScreen from "./screens/NewTransactionScreen";
import LedgerScreen from "./screens/LedgerScreen";
import MoreScreen from "./screens/MoreScreen";
import { BottomNav, type Tab } from "./components/BottomNav";
import { SyncChip } from "./components/SyncChip";

export default function App() {
  const { ready, token } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("home");
  const [ledgerAccount, setLedgerAccount] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void ensureSeeded();
    startSyncEngine();
  }, [token]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-900 text-teal-300">
        <span className="animate-pulse text-lg font-bold">{t("app_title")}</span>
      </div>
    );
  }

  if (!token) return <AuthScreen />;

  function openWallet(accountId: string) {
    setLedgerAccount(accountId);
    setTab("ledger");
  }

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col bg-slate-100 shadow-xl">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-lg font-bold leading-tight text-teal-800">{t("app_title")}</h1>
          <p className="text-[11px] text-slate-400">{t("app_subtitle")}</p>
        </div>
        <SyncChip />
      </header>

      <main className="flex-1 overflow-y-auto">
        {tab === "home" && <DashboardScreen onOpenWallet={openWallet} onNewOperation={() => setTab("new")} />}
        {tab === "new" && <NewTransactionScreen />}
        {tab === "ledger" && <LedgerScreen accountId={ledgerAccount} setAccountId={setLedgerAccount} />}
        {tab === "more" && <MoreScreen />}
      </main>

      <BottomNav
        tab={tab}
        onChange={(next) => {
          setTab(next);
        }}
      />
    </div>
  );
}
