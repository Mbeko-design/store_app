import { useState } from "react";
import { useNavigate } from "react-router";
import { useDemoMode } from "../hooks/useData";
import { resetDemoData } from "../services/seed";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

/**
 * "وضع العرض التجريبي" banner — shown whenever demo data is active.
 * States, in Arabic: the data is fake AND the app is not connected to Vodafone.
 * Includes the required "إعادة ضبط البيانات التجريبية" reset button.
 */
export function DemoBanner() {
  const isDemo = useDemoMode();
  const navigate = useNavigate();
  const toast = useToast();
  const [resetting, setResetting] = useState(false);

  if (!isDemo) return null;

  const reset = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await resetDemoData();
      toast.success("تمت إعادة ضبط البيانات التجريبية");
      navigate("/");
    } catch {
      toast.error("تعذر إعادة ضبط البيانات التجريبية");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-cash-line bg-cash-bg px-4 py-3"
      role="status"
      aria-label="وضع العرض التجريبي"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-cash text-white">
        <Icon name="info" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-cash">وضع العرض التجريبي (Demo mode)</p>
        <p className="text-xs leading-relaxed text-ink-2">
          هذه <strong>بيانات وهمية مُنشأة للتجربة فقط</strong> — والتطبيق <strong>غير متصل بشبكة فيودافون</strong>{" "}
          ولا ينفّذ أي عمليات حقيقية.
        </p>
      </div>
      <Button type="button" variant="secondary" onClick={reset} loading={resetting} className="ms-auto">
        <Icon name="restore" size={16} />
        إعادة ضبط البيانات التجريبية
      </Button>
    </div>
  );
}
