import type { Receipt } from "../shop/types";
import { printReceipt, reserveReceiptPrintWindow } from "../utils/printReceipt";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

export function ReceiptPrintButton({
  receipt,
  variant = "secondary",
  className,
}: {
  receipt: Receipt;
  variant?: "primary" | "secondary" | "quiet";
  className?: string;
}) {
  const toast = useToast();

  const print = () => {
    const printWindow = reserveReceiptPrintWindow();
    if (!printWindow) {
      toast.error("تعذر فتح الطباعة — اسمح بالنوافذ المنبثقة لهذا الموقع");
      return;
    }
    try {
      printReceipt(printWindow, receipt);
    } catch {
      printWindow.close();
      toast.error("تعذرت تهيئة إيصال الطباعة");
    }
  };

  return (
    <Button type="button" variant={variant} className={className} onClick={print}>
      <Icon name="printer" size={16} />
      طباعة الإيصال
    </Button>
  );
}
