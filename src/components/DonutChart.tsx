import { formatEgp } from "../utils/format";

export interface DonutSlice {
  label: string;
  /** Already-formatted display value (no math in components beyond shares). */
  display: string;
  value: number;
  color: string; // CSS color
}

/**
 * Donut chart — SUPPLEMENTARY view only. Readable totals stay visible in the
 * legend and in the summary cards (accessibility rule: never chart-only data).
 * Shares here are presentation geometry, not accounting results.
 */
export function DonutChart({ slices, centerLabel, centerValue }: { slices: DonutSlice[]; centerLabel: string; centerValue: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0);

  if (total <= 0) {
    return (
      <div className="grid place-items-center rounded-md bg-page px-4 py-8 text-center text-sm text-ink-3">
        لا توجد عمليات بعد لعرض التوزيع.
      </div>
    );
  }

  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 100 100" className="size-36 -rotate-90" role="img" aria-label={`توزيع العمليات: ${slices.map((s) => `${s.label} ${s.display}`).join("، ")}`}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="#eef1f6" strokeWidth="14" />
          {slices.map((s) => {
            const len = (s.value / total) * C;
            const el = (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-[11px] font-bold text-ink-3">{centerLabel}</span>
          <span className="text-sm font-extrabold">
            <span className="bidi">{formatEgp(centerValue)}</span>
          </span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
            <span className="font-bold text-ink-2">{s.label}</span>
            <span className="ms-auto font-extrabold">
              <span className="bidi">{s.display}</span>
            </span>
            <span className="w-10 text-end text-xs text-ink-3">
              <span className="bidi">{Math.round((s.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
