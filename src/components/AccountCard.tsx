import { Link } from "react-router";
import type { ReactNode } from "react";
import { formatEgp } from "../utils/format";
import type { AccountView } from "../hooks/useData";
import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";

/**
 * Account card: phone, current balance, remaining limit, status.
 * All figures arrive precomputed by the accounting service (via AccountView).
 */
export function AccountCard({
  view,
  actions,
  showDetails = true,
}: {
  view: AccountView;
  actions?: ReactNode;
  showDetails?: boolean;
}) {
  const { account, balancePiastres, limit } = view;
  const negative = balancePiastres < 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-navy/8 text-navy">
          <Icon name="user" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold">
            <span className="bidi" dir="ltr">
              {account.phone}
            </span>
          </p>
          {account.label && <p className="truncate text-sm text-ink-2">{account.label}</p>}
        </div>
        {account.archivedAtIso && <StatusBadge tone="archived" label="مؤرشف" />}
      </div>

      <div className="rounded-md bg-page p-3">
        <p className="text-xs font-bold text-ink-3">الرصيد الحالي</p>
        <p className={`mt-0.5 text-xl font-extrabold ${negative ? "text-neg" : "text-ink"}`}>
          <span className="bidi">{formatEgp(balancePiastres)}</span>
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-ink-3">المتبقي من الليميت</p>
          <p className={`text-sm font-extrabold ${limit.exceeds ? "text-neg" : "text-ink"}`}>
            <span className="bidi">{formatEgp(limit.remainingPiastres)}</span>
          </p>
        </div>
        <StatusBadge
          tone={limit.exceeds ? "neg" : "pos"}
          label={limit.exceeds ? "تجاوز الليميت" : "ضمن الليميت"}
          title="الليميت الشهري للسحب محسوب على الشهر الحالي"
        />
      </div>

      <div className="mt-auto flex gap-2 pt-1">
        {showDetails && (
          <Link to={`/accounts/${account.id}`} className="h-11 flex-1 rounded-md border border-navy bg-navy px-3 text-sm font-bold text-white hover:bg-navy-soft">
            عرض التفاصيل
          </Link>
        )}
        {actions}
      </div>
    </div>
  );
}
