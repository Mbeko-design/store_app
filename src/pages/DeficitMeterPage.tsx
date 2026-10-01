import { Link } from "react-router";
import { buttonCls } from "../components/Button";
import { Icon } from "../components/Icon";
import { STATUS_META } from "../components/DeficitMeter";
import { LoadingBlock, SkeletonCard } from "../components/Skeleton";
import { useLedger } from "../hooks/useData";
import { formatEgp } from "../utils/format";

/**
 * مقياس العجز detail (screen 7): exact equation, progress bar, itemized
 * breakdown of every input, and an auditable result line. Numbers arrive from
 * the accounting service — this page only lays them out.
 */
export function DeficitMeterPage() {
  const ledger = useLedger();

  if (!ledger) {
    return (
      <div className="space-y-4">
        <LoadingBlock label="جارٍ تحميل المقياس…" />
        <SkeletonCard lines={5} />
      </div>
    );
  }

  const { deficit, totals } = ledger;
  const meta = STATUS_META[deficit.status];
  const sign = deficit.differencePiastres < 0 ? "−" : deficit.differencePiastres > 0 ? "+" : "";

  // Progress: outflows as a share of inflows (pure display geometry).
  const pct = deficit.inflowsPiastres > 0 ? Math.min(100, Math.round((deficit.outflowsPiastres / deficit.inflowsPiastres) * 100)) : deficit.outflowsPiastres > 0 ? 100 : 0;
  const overLimit = deficit.outflowsPiastres > deficit.inflowsPiastres;

  const resultWord =
    deficit.status === "surplus"
      ? `زيادة بمقدار ${formatEgp(deficit.differencePiastres)}`
      : deficit.status === "deficit"
        ? `عجز بمقدار ${formatEgp(Math.abs(deficit.differencePiastres))}`
        : "تمام — الفرق صفر";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Equation */}
      <section aria-label="المعادلة" className="rounded-lg border border-line bg-card p-5 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold">معادلة مقياس العجز</h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-extrabold ${
              deficit.status === "deficit" ? "border-neg-line bg-neg-bg text-neg" : "border-pos-line bg-pos-bg text-pos"
            }`}
          >
            <Icon name={meta.icon} size={16} />
            {meta.label}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm font-bold" dir="rtl">
          <span className="rounded-md border border-line bg-page px-3 py-2">
            (فلوس <span className="bidi text-cash">{formatEgp(totals.cash)}</span> + إيداع{" "}
            <span className="bidi text-pos">{formatEgp(totals.deposit)}</span>)
          </span>
          <span className="text-ink-2">−</span>
          <span className="rounded-md border border-line bg-page px-3 py-2">
            سحب <span className="bidi text-neg">{formatEgp(totals.withdraw)}</span>
          </span>
          <span className="text-ink-2">=</span>
          <span className={`rounded-md border px-3 py-2 text-base font-extrabold ${deficit.status === "deficit" ? "border-neg-line bg-neg-bg text-neg" : "border-pos-line bg-pos-bg text-pos"}`}>
            <span className="bidi">
              {sign}
              {formatEgp(Math.abs(deficit.differencePiastres))}
            </span>
          </span>
        </div>

        {/* Progress bar: الصادر مقابل الوارد */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-ink-2">
            <span>المسحوبات مقابل الوارد</span>
            <span className="bidi">{pct}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="نسبة المسحوبات من إجمالي الوارد">
            <div className={`h-full rounded-full ${overLimit ? "bg-neg" : "bg-pos"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-ink-3">
            {overLimit
              ? "المسحوبات تجاوزت إجمالي الوارد — النتيجة عجز."
              : "المسحوبات أقل من أو تساوي إجمالي الوارد."}
          </p>
        </div>
      </section>

      {/* Itemized breakdown — every input shown, auditable */}
      <section aria-label="التفصيل" className="rounded-lg border border-line bg-card p-5 shadow-card">
        <h2 className="text-lg font-extrabold">تفصيل المدخلات</h2>
        <ul className="mt-3 divide-y divide-line">
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-2 text-sm font-bold">
              <span className="grid size-7 place-items-center rounded-md bg-pos-bg text-pos">
                <Icon name="plus" size={14} />
              </span>
              إجمالي الفلوس
            </span>
            <span className="font-extrabold text-pos">
              <span className="bidi">{formatEgp(totals.cash)}</span>
            </span>
          </li>
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-2 text-sm font-bold">
              <span className="grid size-7 place-items-center rounded-md bg-pos-bg text-pos">
                <Icon name="plus" size={14} />
              </span>
              إجمالي الإيداعات
            </span>
            <span className="font-extrabold text-pos">
              <span className="bidi">{formatEgp(totals.deposit)}</span>
            </span>
          </li>
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-2 text-sm font-bold">
              <span className="grid size-7 place-items-center rounded-md bg-neg-bg text-neg">
                <Icon name="arrowDown" size={14} />
              </span>
              إجمالي المسحوبات
            </span>
            <span className="font-extrabold text-neg">
              <span className="bidi">−{formatEgp(totals.withdraw)}</span>
            </span>
          </li>
        </ul>

        {/* Result line */}
        <div className={`mt-4 flex items-center gap-3 rounded-md border p-4 ${deficit.status === "deficit" ? "border-neg-line bg-neg-bg" : "border-pos-line bg-pos-bg"}`}>
          <span className={`grid size-10 shrink-0 place-items-center rounded-md ${deficit.status === "deficit" ? "bg-neg text-white" : "bg-pos text-white"}`}>
            <Icon name={meta.icon} size={20} />
          </span>
          <p className="text-sm">
            <span className="font-bold">النتيجة:</span>{" "}
            <span className={`font-extrabold ${deficit.status === "deficit" ? "text-neg" : "text-pos"}`}>{resultWord}</span>
          </p>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
          كل رقم أعلاه مشتق مباشرة من سجل العمليات (كل عملية تُحتسب مرة واحدة تحت نوعها). لا تُحتسب عمليات الفلوس على
          أرصدة المحافظ — لكنها تدخل ضمن الوارد في هذه المعادلة.
        </p>
      </section>

      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/" className={buttonCls("secondary")}>
          العودة للوحة التحكم
        </Link>
        <Link to="/history/withdraw" className={buttonCls("ghost")}>
          مراجعة سجل السحب
        </Link>
      </div>
    </div>
  );
}
