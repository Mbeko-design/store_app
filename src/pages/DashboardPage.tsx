import { Link, useNavigate } from "react-router";
import { DeficitMeter } from "../components/DeficitMeter";
import { DonutChart } from "../components/DonutChart";
import { Button, buttonCls } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Icon, type IconName } from "../components/Icon";
import { LoadingBlock, SkeletonCard, SkeletonList } from "../components/Skeleton";
import { SummaryCard } from "../components/SummaryCard";
import { AccountCard } from "../components/AccountCard";
import { useLedger } from "../hooks/useData";
import { grandTotal } from "../accounting";
import { loadPreviewData } from "../services/seed";
import { useToast } from "../components/Toast";
import { formatEgp, formatDateTime } from "../utils/format";
import { CASH_SOURCE_LABEL, TYPE_LABEL, TYPE_STYLE } from "../utils/labels";

const QUICK: Array<{ type: "withdraw" | "deposit" | "cash" | ""; label: string; icon: IconName }> = [
  { type: "withdraw", label: "سحب", icon: "arrowDown" },
  { type: "deposit", label: "إيداع", icon: "arrowUp" },
  { type: "cash", label: "فلوس", icon: "wallet" },
  { type: "", label: "إضافة عملية", icon: "plus" },
];

export function DashboardPage() {
  const ledger = useLedger();
  const toast = useToast();
  const navigate = useNavigate();

  if (!ledger) {
    return (
      <div className="space-y-4">
        <LoadingBlock label="جارٍ تحميل اللوحة…" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
        <SkeletonList rows={4} />
      </div>
    );
  }

  const { totals, deficit, views, operations, accounts } = ledger;
  const isEmpty = accounts.length === 0 && operations.length === 0;
  const accountLabels = new Map<string, string>(accounts.map((a) => [a.id, `${a.phone}${a.label ? ` — ${a.label}` : ""}`]));
  const recent = operations.slice(0, 6);

  const loadPreview = async () => {
    try {
      await loadPreviewData();
      toast.success("تم تحميل بيانات تجريبية للعرض");
    } catch {
      toast.error("لا يمكن التحميل: البيانات ليست فارغة");
    }
  };

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-lg border border-line bg-card p-6 text-center shadow-card">
          <span className="mx-auto grid size-14 place-items-center rounded-md bg-navy/8 text-navy">
            <Icon name="wallet" size={28} />
          </span>
          <h2 className="mt-3 text-xl font-extrabold">أهلًا بك في CASHY</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            دفتر محاسبة شخصي لحسابات فيودافون كاش — سجّل أول حساب لتبدأ في تتبّع الأرصدة وعمليات السحب والإيداع والفلوس.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/accounts" className={buttonCls("primary")}>
              <Icon name="plus" size={16} />
              إضافة أول حساب
            </Link>
            <Button type="button" variant="secondary" onClick={loadPreview}>
              تحميل بيانات تجريبية
            </Button>
          </div>
          <p className="mt-4 text-[11px] text-ink-3">البيانات محفوظة محليًا على هذا الجهاز فقط — CASHY لا يتصل بأي شبكة.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary row: 3 totals + deficit meter */}
      <section aria-label="الإجماليات" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="إجمالي الإيداعات" amount={formatEgp(totals.deposit)} tone="pos" icon="arrowUp" sub="مجموع عمليات الإيداع" />
        <SummaryCard label="إجمالي الفلوس" amount={formatEgp(totals.cash)} tone="cash" icon="wallet" sub="مجموع عمليات الفلوس" />
        <SummaryCard label="إجمالي المسحوبات" amount={formatEgp(totals.withdraw)} tone="neg" icon="arrowDown" sub="مجموع عمليات السحب" />
        <DeficitMeter result={deficit} compact />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Accounts + recent operations */}
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="your-accounts">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="your-accounts" className="text-lg font-extrabold">
                حساباتك
                <span className="ms-2 text-sm font-bold text-ink-3">
                  (<span className="bidi">{views.length}</span>)
                </span>
              </h2>
              <Link to="/accounts" className={buttonCls("secondary", "h-10")}>
                <Icon name="plus" size={16} />
                إضافة حساب
              </Link>
            </div>
            {views.length === 0 ? (
              <EmptyState
                icon="wallet"
                title="لا توجد حسابات بعد"
                description="أضف حسابك الأول لتظهر أرصدتك وعملياته هنا."
                action={
                  <Link to="/accounts" className={buttonCls("primary")}>
                    إضافة حساب
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {views.map((v) => (
                  <AccountCard key={v.account.id} view={v} />
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="recent-ops">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="recent-ops" className="text-lg font-extrabold">
                آخر العمليات
              </h2>
              <span className="text-xs text-ink-3">مرتبة من الأحدث</span>
            </div>
            {recent.length === 0 ? (
              <EmptyState icon="list" title="لا توجد عمليات بعد" description="سجّل أول عملية من زر «إضافة عملية»." />
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line bg-card">
                {recent.map((op) => {
                  const style = TYPE_STYLE[op.type];
                  const source = op.accountId === "cash" ? CASH_SOURCE_LABEL : accountLabels.get(op.accountId) ?? "";
                  return (
                    <li key={op.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`size-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className={`text-sm font-extrabold ${style.text}`}>{TYPE_LABEL[op.type]}</span>
                          <span className="truncate text-sm text-ink-2">{source}</span>
                        </div>
                        <p className="truncate text-xs text-ink-3">
                          <span className="bidi">{formatDateTime(op.occurredAtIso)}</span>
                          {op.note ? ` · ${op.note}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 text-sm font-extrabold ${style.text}`}>
                        <span className="bidi">{formatEgp(op.amountPiastres)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Side: donut overview + quick actions */}
        <div className="space-y-6">
          <section aria-labelledby="ops-overview" className="rounded-lg border border-line bg-card p-4 shadow-card">
            <h2 id="ops-overview" className="text-lg font-extrabold">
              نظرة عامة على العمليات
            </h2>
            <p className="mb-3 text-xs text-ink-3">إجماليات كل نوع (تكميلية — الأرقام الكاملة في البطاقات أعلاه)</p>
            <DonutChart
              centerLabel="الإجمالي الكلي"
              centerValue={grandTotal(totals)}
              slices={[
                { label: "إيداع", display: formatEgp(totals.deposit), value: totals.deposit, color: "#16a34a" },
                { label: "فلوس", display: formatEgp(totals.cash), value: totals.cash, color: "#2563eb" },
                { label: "سحب", display: formatEgp(totals.withdraw), value: totals.withdraw, color: "#dc2626" },
              ]}
            />
          </section>

          <section aria-labelledby="quick-actions" className="rounded-lg border border-line bg-card p-4 shadow-card">
            <h2 id="quick-actions" className="text-lg font-extrabold">
              إجراءات سريعة
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {QUICK.map((q) => (
                <Link
                  key={q.label}
                  to={q.type ? `/add?type=${q.type}` : "/add"}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-page text-sm font-bold text-navy hover:bg-card"
                >
                  <Icon name={q.icon} size={16} />
                  {q.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-dashed border-line p-4 text-center" aria-label="تقارير">
            <p className="text-xs text-ink-3">تقارير تفصيلية</p>
            <div className="mt-2 flex justify-center gap-3">
              <button type="button" onClick={() => navigate("/summary")} className="text-xs font-bold text-cash underline underline-offset-2">
                ملخص الحسابات
              </button>
              <button type="button" onClick={() => navigate("/deficit")} className="text-xs font-bold text-cash underline underline-offset-2">
                تفاصيل مقياس العجز
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
