import { Button } from "./Button";
import { Icon } from "./Icon";

/** Pagination — page N of M with disabled states at the ends. */
export function Pagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  return (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="التنقل بين الصفحات">
      <p className="text-sm text-ink-2">
        <span className="bidi">{total}</span> عنصر
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="الصفحة السابقة"
          type="button"
        >
          <Icon name="chevronRight" size={18} />
          السابق
        </Button>
        <span className="px-2 text-sm font-bold text-ink-2">
          صفحة <span className="bidi">{page}</span> من <span className="bidi">{Math.max(pageCount, 1)}</span>
        </span>
        <Button
          variant="secondary"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          aria-label="الصفحة التالية"
          type="button"
        >
          التالي
          <Icon name="chevronLeft" size={18} />
        </Button>
      </div>
    </nav>
  );
}
