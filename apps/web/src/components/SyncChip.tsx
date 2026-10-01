import { useLang } from "../i18n/lang";
import { useSyncStatus } from "../lib/hooks";
import { Icon } from "./Icon";

export function SyncChip() {
  const { t } = useLang();
  const { syncing, error, lastSyncAt, pending, online } = useSyncStatus();

  let tone = "bg-emerald-100 text-emerald-800";
  let label = t("sync_synced");

  if (!online) {
    tone = "bg-slate-200 text-slate-600";
    label = t("sync_offline");
  } else if (syncing) {
    tone = "bg-sky-100 text-sky-800";
    label = t("sync_syncing");
  } else if (error) {
    tone = "bg-red-100 text-red-700";
    label = t("sync_error");
  } else if (pending > 0) {
    tone = "bg-amber-100 text-amber-800";
    label = t("sync_pending", { n: pending });
  }

  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}
      title={lastSyncAt ? new Date(lastSyncAt).toLocaleString() : undefined}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${syncing ? "animate-pulse bg-current" : "bg-current"}`} />
      {label}
    </span>
  );
}
