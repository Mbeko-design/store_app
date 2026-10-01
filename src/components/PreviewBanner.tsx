import { useNavigate } from "react-router";
import { useLedger, usePreviewFlag } from "../hooks/useData";
import { removePreviewData } from "../services/seed";
import { useToast } from "./Toast";
import { Icon } from "./Icon";

/**
 * Persistent banner while PREVIEW (sample) data is loaded —
 * spec: seed data is for design preview only, clearly marked.
 */
export function PreviewBanner() {
  const isPreview = usePreviewFlag();
  const navigate = useNavigate();
  const toast = useToast();

  if (!isPreview) return null;

  const remove = async () => {
    try {
      await removePreviewData();
      toast.success("تم حذف البيانات التجريبية");
      navigate("/");
    } catch {
      toast.error("تعذر حذف البيانات التجريبية");
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-cash-line bg-cash-bg px-4 py-3 text-sm text-cash" role="status">
      <Icon name="info" size={18} />
      <span className="font-bold">بيانات تجريبية للعرض فقط — غير بياناتك الفعلية.</span>
      <div className="ms-auto flex gap-2">
        <button
          type="button"
          onClick={remove}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neg-line bg-neg-bg px-3 font-bold text-neg"
        >
          <Icon name="trash" size={14} />
          حذف البيانات التجريبية
        </button>
      </div>
    </div>
  );
}
