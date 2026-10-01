import { useLocation } from "react-router";
import { useProfile } from "../hooks/useData";
import { initialsOf } from "../utils/format";
import { Icon } from "./Icon";

/** Route → page title (single source for header + document semantics). */
export function pageTitle(pathname: string): string {
  if (pathname === "/") return "لوحة التحكم";
  if (pathname.startsWith("/accounts/")) return "تفاصيل الحساب";
  if (pathname === "/accounts") return "الحسابات";
  if (pathname.startsWith("/history/")) {
    const map: Record<string, string> = { withdraw: "سجل السحب", deposit: "سجل الإيداع", cash: "سجل الفلوس" };
    return map[pathname.split("/")[2] ?? ""] ?? "سجل العمليات";
  }
  if (pathname === "/add") return "إضافة عملية";
  if (pathname === "/summary") return "ملخص الحسابات";
  if (pathname === "/deficit") return "مقياس العجز";
  if (pathname === "/settings") return "الإعدادات";
  return "CASHY";
}

/** Top header: menu button (below lg), page title, avatar + user name. */
export function TopHeader({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation();
  const profile = useProfile();
  const title = pageTitle(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 md:h-16 md:px-6">
        <button
          type="button"
          onClick={onMenu}
          className="grid size-10 shrink-0 place-items-center rounded-md border border-line text-ink-2 hover:bg-page lg:hidden"
          aria-label="فتح القائمة"
        >
          <Icon name="menu" size={20} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-extrabold md:text-lg">{title}</h1>
        <div className="flex items-center gap-2.5">
          <div className="hidden text-end sm:block">
            <p className="text-sm font-bold leading-tight">{profile?.name ?? "…"}</p>
            <p className="text-[11px] text-ink-3">حساب شخصي</p>
          </div>
          <span className="grid size-9 place-items-center rounded-full bg-navy text-sm font-extrabold text-white" aria-hidden="true">
            {initialsOf(profile?.name ?? "؟")}
          </span>
        </div>
      </div>
    </header>
  );
}
