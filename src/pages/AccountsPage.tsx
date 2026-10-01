import { useState } from "react";
import { Link } from "react-router";
import { AccountFormDialog } from "../components/AccountFormDialog";
import { AccountCard } from "../components/AccountCard";
import { Button, buttonCls } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { LoadingBlock, SkeletonCard } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useLedger } from "../hooks/useData";
import { archiveAccount, restoreAccount } from "../services/accountsService";
import { loadPreviewData } from "../services/seed";

/**
 * Accounts: grid of cards + add / edit / archive (with confirmation) / restore.
 * Plus a link to the detailed accounts summary table (screen 6).
 */
export function AccountsPage() {
  const ledger = useLedger();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  if (!ledger) {
    return (
      <div className="space-y-4">
        <LoadingBlock label="جارٍ تحميل الحسابات…" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const { views, archivedViews, archivedAccounts, operations } = ledger;
  const editing = views.find((v) => v.account.id === editingId)?.account;
  const archiving = views.find((v) => v.account.id === archivingId);
  const restoring = archivedAccounts.find((a) => a.id === restoringId);

  const openCreate = () => {
    setEditingId(null);
    setFormOpen(true);
  };
  const openEdit = (id: string) => {
    setEditingId(id);
    setFormOpen(true);
  };

  const doArchive = async () => {
    if (!archivingId) return;
    setArchiveLoading(true);
    try {
      await archiveAccount(archivingId);
      toast.success("تم أرشفة الحساب");
      setArchivingId(null);
    } catch {
      toast.error("تعذر أرشفة الحساب");
    } finally {
      setArchiveLoading(false);
    }
  };

  const doRestore = async () => {
    if (!restoringId) return;
    try {
      await restoreAccount(restoringId);
      toast.success("تم إرجاع الحساب");
    } catch {
      toast.error("تعذر إرجاع الحساب");
    } finally {
      setRestoringId(null);
    }
  };

  const loadPreview = async () => {
    try {
      await loadPreviewData();
      toast.success("تم تحميل بيانات تجريبية للعرض");
    } catch {
      toast.error("لا يمكن التحميل: البيانات ليست فارغة");
    }
  };

  const isEmpty = views.length === 0 && archivedAccounts.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          <span className="bidi">{views.length}</span> حساب فعّال
          {archivedAccounts.length > 0 && (
            <>
              {" · "}
              <span className="bidi">{archivedAccounts.length}</span> مؤرشف
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/summary" className={buttonCls("secondary")}>
            <Icon name="table" size={16} />
            ملخص الحسابات — تفصيلي
          </Link>
          <Button type="button" onClick={openCreate}>
            <Icon name="plus" size={16} />
            إضافة حساب
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <div className="space-y-4">
          <EmptyState
            icon="wallet"
            title="لا توجد حسابات"
            description="أضف حساب فيودافون كاش لتبدأ — رقم الموبايل + الليميت الشهري + الرصيد الافتتاحي."
            action={
              <Button type="button" onClick={openCreate}>
                <Icon name="plus" size={16} />
                إضافة حساب
              </Button>
            }
          />
          {operations.length === 0 && (
            <div className="text-center">
              <Button type="button" variant="secondary" onClick={loadPreview}>
                تحميل بيانات تجريبية للعرض فقط
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <section aria-label="الحسابات الفعّالة">
            {views.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {views.map((v) => (
                  <AccountCard
                    key={v.account.id}
                    view={v}
                    actions={
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(v.account.id)}
                          className="grid size-11 place-items-center rounded-md border border-line text-ink-2 hover:bg-page"
                          aria-label={`تعديل الحساب ${v.account.phone}`}
                          title="تعديل"
                        >
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setArchivingId(v.account.id)}
                          className="grid size-11 place-items-center rounded-md border border-line text-neg hover:bg-neg-bg"
                          aria-label={`أرشفة الحساب ${v.account.phone}`}
                          title="أرشفة"
                        >
                          <Icon name="archive" size={16} />
                        </button>
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {archivedAccounts.length > 0 && (
            <section aria-labelledby="archived-heading" className="space-y-3">
              <h2 id="archived-heading" className="text-base font-extrabold text-ink-2">
                الحسابات المؤرشفة
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archivedViews.map((v) => (
                  <div key={v.account.id} className="opacity-80">
                    <AccountCard
                      view={v}
                      showDetails={false}
                      actions={
                        <Button type="button" variant="secondary" className="flex-1" onClick={() => setRestoringId(v.account.id)}>
                          <Icon name="restore" size={16} />
                          إرجاع
                        </Button>
                      }
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <AccountFormDialog open={formOpen} account={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={!!archivingId}
        danger
        title="أرشفة الحساب؟"
        message={
          <>
            سيختفي الحساب من القوائم الفعّالة مع الاحتفاظ بكل عملياته. يمكنك إعادته لاحقًا من قسم «الحسابات المؤرشفة».
            {archiving ? (
              <>
                <br />
                <span className="bidi" dir="ltr">
                  {archiving.account.phone}
                </span>
              </>
            ) : null}
          </>
        }
        confirmLabel="أرشفة"
        loading={archiveLoading}
        onConfirm={doArchive}
        onClose={() => setArchivingId(null)}
      />

      <ConfirmDialog
        open={!!restoringId}
        title="إرجاع الحساب؟"
        message="سيعود الحساب إلى القائمة الفعّالة بكل عملياته السابقة."
        confirmLabel="إرجاع"
        onConfirm={doRestore}
        onClose={() => setRestoringId(null)}
      />
    </div>
  );
}
