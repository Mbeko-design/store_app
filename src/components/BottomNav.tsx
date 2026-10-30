import { NavLink } from "react-router";
import { Icon, type IconName } from "./Icon";

const ITEMS: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: "/", label: "الرئيسية", icon: "home", end: true },
  { to: "/accounts", label: "الحسابات", icon: "wallet" },
  { to: "/shop", label: "المتجر", icon: "box", end: true },
  { to: "/add", label: "إضافة عملية", icon: "plus" },
];

/** Mobile bottom navigation: 4 items, ≥44px targets, safe-area aware. */
export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="التنقل السريع"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 text-[11px] font-bold ${
                  isActive ? "border-navy text-navy" : "border-transparent text-ink-2"
                }`
              }
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
