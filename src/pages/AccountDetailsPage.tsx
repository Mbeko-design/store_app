import { useState } from "react";
import { Link, useParams } from "react-router";
import { AccountFormDialog } from "../components/AccountFormDialog";
import { Button, buttonCls } from "../components/Button";
import { CategoryTabs, type DetailTab } from "../components/CategoryTabs";
import { EmptyState } from "../components/EmptyState";
import { Icon, type IconName } from "../components/Icon";
import { LoadingBlock, SkeletonCard, SkeletonList } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { useAccountView, useAllOperations } from "../hooks/useData";
import { restoreAccount } from "../services/accountsService";
import { formatEgp } from "../utils/format";
import { CASH_SOURCE_LABEL, TYPE_LABEL, TYPE_STYLE } from "../utils/labels";
import type { OperationType } from "../accounting/types";

const CATS: Array<{ type: OperationType; label: string; icon: IconName }> = [
  { type: "withdraw", label: "سحب", icon: "arrowDown" },
  { type: "deposit", label: "إيداع", icon: "arrowUp" },
  { type: "cash", label: "فلوس", icon: "wallet" },
];

export function AccountDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const state = useAccountView(id);
  const allOps = useAllOperations();
  const [tab, setTab] = useState<DetailTab>("summary");
  const [editOpen, setEditOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const toast = useToast();

  if (state.status === "loading" || !allOps) {
    return (
      <div className="space-y-4">
        <LoadingBlock label="جارٍ تحميل تفاصيل الحساب…" />
        <SkeletonCard lines={4} />
        <SkeletonList rows={4} />
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <EmptyState
        icon="alert"
        title="الحساب غير موجود"
        description="ربما حُذف أو تغيّر الرابط."
        action={
          <Link to="/accounts" className={buttonCls("primary")}>
            العودة إلى الحسابات
          </Link>
        }
      />
    );
  }

  const { view } = state;
  const { account, balancePiastres, limit, totals } = view;
  const ownOps = allOps.filter((o) => o.accountId === account.id);
  const accountLabels = new Map<string, string>([[account.id, `${account.phone}${account.label ? ` — ${account.label}` : ""}`]]);
  const tabOps = tab === "summary" ? ownOps : ownOps.filter((o) => o.type === tab);
  const recentOps = tabOps.slice(0, 8);
  const archived = !!account.archivedAtIso;

  const doRestore = async () => {
    setRestoring(true);
    try {
      await restoreAccount(account.id);
      toast.success("تم إرجاع الحساب");
    } catch {
      toast.error("تعذر إرجاع الحساب");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header: phone + edit, balance + remaining limit (account-level) */}
      <section className="rounded-lg border border-line bg-card p-4 shadow-card md:p-5" aria-label="بيانات الحساب">
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-navy/8 text-navy">
            <Icon name="user" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold">
                <span className="bidi" dir="ltr">
                  {account.phone}
                </span>
              </h2>
              {archived && <StatusBadge tone="archived" label="مؤرشف" />}
            </div>
            {account.label && <p className="text-sm text-ink-2">{account.label}</p>}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(true)} aria-label="تعديل الحساب">
              <Icon name="edit" size={16} />
              تعديل
            </Button>
            {archived && (
              <Button type="button" variant="primary" onClick={doRestore} loading={restoring}>
                <Icon name="restore" size={16} />
                إرجاع
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-page p-3">
            <p className="text-xs font-bold text-ink-3">الرصيد الحالي</p>
            <p className={`mt-0.5 text-2xl font-extrabold ${balancePiastres < 0 ? "text-neg" : "text-ink"}`}>
              <span className="bidi">{formatEgp(balancePiastres)}</span>
            </p>
          </div>
          <div className="rounded-md bg-page p-3">
            <p className="text-xs font-bold text-ink-3">المتبقي من الليميت (الشهر الحالي)</p>
            <p className={`mt-0.5 text-2xl font-extrabold ${limit.exceeds ? "text-neg" : "text-ink"}`}>
              <span className="bidi">{formatEgp(limit.remainingPiastres)}</span>
            </p>
          </div>
          <div className="flex flex-col justify-between gap-2 rounded-md bg-page p-3">
            <div>
              <p className="text-xs font-bold text-ink-3">ليميت الشهر / المستخدم</p>
              <p className="mt-0.5 text-sm font-extrabold">
                <span className="bidi">
                  {formatEgp(limit.limitPiastres)} / {formatEgp(limit.usedPiastres)}
                </span>
              </p>
            </div>
            <StatusBadge tone={limit.exceeds ? "neg" : "pos"} label={limit.exceeds ? "تجاوز الليميت" : "ضمن الليميت"} />
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
          هذه أرقام <strong>على مستوى الحساب فقط</strong> — الإجماليات العامة لكل الحسابات موجودة في لوحة التحكم. الرصيد = الافتتاحي + إيداعات − سحوبات؛ عمليات الفلوس لا تغيّر رصيد المحفظة.
        </p>
      </section>

      {/* Category quick actions → prefilled add-operation form */}
      <section aria-label="إضافة عملية لهذا الحساب" className="grid grid-cols-3 gap-2">
        {CATS.map((c) => {
          const inner = (
            <>
              <Icon name={c.icon} size={18} />
              {c.label}
            </>
          );
          const cls = `flex min-h-12 items-center justify-center gap-2 rounded-md border text-sm font-extrabold ${
            archived ? "border-line bg-page text-ink-3" : "border-line bg-card text-navy hover:bg-page"
          }`;
          return archived ? (
            <span key={c.type} className={cls} aria-disabled="true" title="الحساب مؤرشف">
              {inner}
            </span>
          ) : (
            <Link key={c.type} to={`/add?type=${c.type}&account=${account.id}`} className={cls}>
              {inner}
            </Link>
          );
        })}
      </section>
      {archived && (
        <p className="-mt-3 text-xs font-bold text-neg">الحساب مؤرشف — أعدته لتسجيل عمليات جديدة عليه.</p>
      )}

      {/* Tabs */}
      <section aria-label="محتوى الحساب">
        <CategoryTabs value={tab} onChange={setTab} />

        <div className="mt-4 space-y-4">
          {tab === "summary" && (
            <div className="grid gap-3 sm:grid-cols-3">
              {CATS.map((c) => (
                <div key={c.type} className="rounded-md border border-line bg-card p-3">
                  <p className="text-xs font-bold text-ink-3">إجمالي {TYPE_LABEL[c.type]} (حساب)</p>
                  <p className={`mt-0.5 text-lg font-extrabold ${TYPE_STYLE[c.type].text}`}>
                    <span className="bidi">{formatEgp(totals[c.type])}</span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {tab !== "summary" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-card p-4">
              <div>
                <p className="text-sm font-bold text-ink-2">إجمالي {TYPE_LABEL[tab]} (على مستوى الحساب)</p>
                <p className={`text-2xl font-extrabold ${TYPE_STYLE[tab as OperationType].text}`}>
                  <span className="bidi">{formatEgp(totals[tab as OperationType])}</span>
                </p>
              </div>
              <Link to={`/history/${tab}?account=${account.id}`} className={buttonCls("secondary", "h-10")}>
                السجل الكامل
                <Icon name="chevronLeft" size={16} />
              </Link>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                {tab === "summary" ? "آخر العمليات على الحساب" : `آخر عمليات ${TYPE_LABEL[tab as OperationType]}`}
              </h3>
              <span className="text-xs text-ink-3">
                <span className="bidi">{ownOps.length}</span> عملية
              </span>
            </div>
            {recentOps.length === 0 ? (
              <EmptyState icon="list" title="لا توجد عمليات" description="لا توجد عمليات مسجلة بهذا التصنيف على هذا الحساب." />
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line bg-card">
                {recentOps.map((op) => (
                  <li key={op.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`size-2.5 shrink-0 rounded-full ${TYPE_STYLE[op.type].dot}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <span className={`text-sm font-extrabold ${TYPE_STYLE[op.type].text}`}>{TYPE_LABEL[op.type]}</span>
                      {op.accountId === "cash" && <span className="ms-2 text-sm text-ink-2">{CASH_SOURCE_LABEL}</span>}
                      <p className="truncate text-xs text-ink-3">
                        <span className="bidi">{formatEgp(op.amountPiastres)}</span>
                        {op.note ? ` · ${op.note}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-3">
                      <span className="bidi">{new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "short", timeStyle: "short" }).format(new Date(op.occurredAtIso))}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {ownOps.length > recentOps.length && (
              <div className="mt-3">
                <Link to={`/history/${tab === "summary" ? "withdraw" : tab}?account=${account.id}`} className="text-sm font-bold text-cash underline underline-offset-2">
                  عرض كل العمليات
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <AccountFormDialog open={editOpen} account={account} onClose={() => setEditOpen(false)} />
    </div>
  );
}
