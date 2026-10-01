import { useLiveQuery } from "dexie-react-hooks";
import { useLang, type Lang } from "../i18n/lang";
import { useAuth } from "../lib/auth";
import { useSyncStatus } from "../lib/hooks";
import { runSync } from "../lib/sync";
import { getDeviceId } from "../lib/token";
import { entryCount } from "../db/repo";
import { Icon } from "../components/Icon";

const APP_VERSION = "0.1.0";

export default function MoreScreen() {
  const { t, lang, setLang } = useLang();
  const { email, logout } = useAuth();
  const { syncing, error, lastSyncAt, pending, online } = useSyncStatus();
  const entries = useLiveQuery(() => entryCount(), [], 0);

  return (
    <div className="space-y-4 p-4">
      <h2 className="px-1 text-lg font-bold text-slate-800">{t("more_title")}</h2>

      {/* Language */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon name="globe" className="h-4 w-4 text-slate-400" />
          {t("more_language")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLang("ar")}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
              lang === "ar" ? "border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-600/20" : "border-slate-200 text-slate-600"
            }`}
          >
            العربية
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
              lang === "en" ? "border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-600/20" : "border-slate-200 text-slate-600"
            }`}
          >
            English
          </button>
        </div>
      </section>

      {/* Sync */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon name="refresh" className={`h-4 w-4 text-slate-400 ${syncing ? "animate-spin" : ""}`} />
          {t("more_sync")}
        </div>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-400">{t("sync_last")}</dt>
            <dd className="font-medium text-slate-700">
              {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-EG") : t("sync_never")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">{t("nav_ledger")}</dt>
            <dd className="font-medium text-slate-700">{pending > 0 ? t("sync_pending", { n: pending }) : t("sync_synced")}</dd>
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{t("sync_error")}: {error}</div>
          )}
        </dl>
        <button
          type="button"
          onClick={() => void runSync()}
          disabled={syncing || !online}
          className="mt-3 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
        >
          {t("sync_now")}
        </button>
      </section>

      {/* Account & data */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-slate-700">{t("more_account")}</div>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-slate-400">{t("more_signed_in_as")}</dt>
            <dd className="truncate font-medium text-slate-700" dir="ltr">
              {email}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-slate-400">{t("more_device")}</dt>
            <dd className="truncate font-mono text-xs text-slate-500" dir="ltr">
              {getDeviceId()}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">{t("more_data")}</dt>
            <dd className="font-medium text-slate-700">
              {entries} {t("more_entries_stored")}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={logout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
        >
          <Icon name="logout" className="h-4 w-4" />
          {t("more_logout")}
        </button>
      </section>

      <section className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm">
        <p className="leading-relaxed">{t("more_about")}</p>
        <p className="mt-2 text-xs text-slate-400">
          {t("more_version")} {APP_VERSION}
        </p>
      </section>
    </div>
  );
}
