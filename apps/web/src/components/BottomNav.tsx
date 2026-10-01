import { useLang } from "../i18n/lang";
import { Icon, type IconName } from "./Icon";

export type Tab = "home" | "new" | "ledger" | "more";

const TABS: Array<{ id: Tab; icon: IconName; key: "nav_home" | "nav_new" | "nav_ledger" | "nav_more" }> = [
  { id: "home", icon: "home", key: "nav_home" },
  { id: "new", icon: "plus", key: "nav_new" },
  { id: "ledger", icon: "list", key: "nav_ledger" },
  { id: "more", icon: "sliders", key: "nav_more" },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const { t } = useLang();
  return (
    <nav className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {TABS.map(({ id, icon, key }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-teal-700" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon name={icon} className={`h-6 w-6 ${active ? "stroke-2.5" : ""}`} />
              {t(key)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
