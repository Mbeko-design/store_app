import { NavLink } from "react-router";
import { Icon, type IconName } from "./Icon";

const NAV: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: "/", label: "لوحة التحكم", icon: "home", end: true },
  { to: "/accounts", label: "الحسابات", icon: "wallet" },
  { to: "/add", label: "إضافة عملية", icon: "plus" },
];

/** Separate section: shop management (phone shop) — own group with a divider. */
const SHOP_NAV: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: "/shop", label: "لوحة المتجر", icon: "chart", end: true },
  { to: "/shop/products", label: "المنتجات", icon: "box" },
  { to: "/shop/pos", label: "نقطة البيع", icon: "receipt" },
  { to: "/shop/inventory", label: "المخزون", icon: "barcode" },
  { to: "/shop/sales", label: "المبيعات", icon: "table" },
];

const BOTTOM: Array<{ to: string; label: string; icon: IconName }> = [{ to: "/settings", label: "الإعدادات", icon: "settings" }];

/**
 * Right-side navy sidebar (RTL). Static on desktop (lg+), drawer below.
 * Contains: logo (CASHY), primary nav, settings, logout (disabled — see spec).
 */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-navy/45 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-64 flex-col bg-navy transition-transform duration-200 lg:static lg:w-60 lg:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="القائمة الرئيسية"
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-md bg-white text-lg font-black text-navy" aria-hidden="true">
              C
            </span>
            <span className="text-xl font-extrabold tracking-wide text-white">CASHY</span>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white lg:hidden" aria-label="إغلاق القائمة">
            <Icon name="close" size={20} />
          </button>
        </div>

        <nav className="mt-2 flex-1 overflow-y-auto px-3" aria-label="أقسام التطبيق">
          {/* Cash management — the money ledger */}
          <p className="px-3 pb-1.5 text-[10px] font-extrabold tracking-wider text-white/45">إدارة الكاش</p>
          <div className="space-y-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm font-bold transition-colors ${
                    isActive ? "border-white/15 bg-white/12 text-white" : "border-transparent text-white/70 hover:bg-white/8 hover:text-white"
                  }`
                }
              >
                <Icon name={item.icon} size={18} />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Shop management — separate section */}
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="px-3 pb-1.5 text-[10px] font-extrabold tracking-wider text-white/45">إدارة المتجر</p>
            <div className="space-y-1">
              {SHOP_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm font-bold transition-colors ${
                      isActive ? "border-white/15 bg-white/12 text-white" : "border-transparent text-white/70 hover:bg-white/8 hover:text-white"
                    }`
                  }
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        <div className="space-y-1 border-t border-white/10 p-3">
          {BOTTOM.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm font-bold transition-colors ${
                  isActive ? "border-white/15 bg-white/12 text-white" : "border-transparent text-white/70 hover:bg-white/8 hover:text-white"
                }`
              }
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </NavLink>
          ))}
          {/* Logout: NOT implemented (no auth in v1) — disabled per spec (no fake functionality). */}
          <button
            type="button"
            disabled
            title="قريباً"
            className="flex min-h-11 w-full cursor-not-allowed items-center gap-3 rounded-md border border-transparent px-3 text-sm font-bold text-white/40"
            aria-disabled="true"
          >
            <Icon name="logout" size={18} />
            تسجيل الخروج
            <span className="ms-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">قريباً</span>
          </button>
          <p className="px-3 pb-1 pt-3 text-[11px] leading-relaxed text-white/45">
            دفتر محاسبة شخصي — CASHY لا يتصل بشبكة فودافون ولا ينفذ عمليات حقيقية.
          </p>
        </div>
      </aside>
    </>
  );
}
