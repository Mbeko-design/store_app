import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button, buttonCls } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Field, inputCls } from "../components/Field";
import { Icon } from "../components/Icon";
import { LoadingBlock } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useAllOperations, useAccounts, useDemoMode, useProfile } from "../hooks/useData";
import { clearAllData, saveProfile } from "../services/settingsService";
import { loadPreviewData, resetDemoData } from "../services/seed";
import { initialsOf } from "../utils/format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Settings (screen 8): profile, list items (unimplemented ones disabled), simple preference cards. */
export function SettingsPage() {
  const profile = useProfile();
  const accounts = useAccounts(true);
  const operations = useAllOperations();
  const isDemo = useDemoMode();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
    }
  }, [profile]);

  if (!profile || !accounts || !operations) {
    return (
      <div className="space-y-4">
        <LoadingBlock label="جارٍ تحميل الإعدادات…" />
      </div>
    );
  }

  const save = async () => {
    if (saving) return;
    let ok = true;
    if (!name.trim() || name.trim().length > 40) {
      setNameError("الاسم مطلوب (40 حرفًا كحد أقصى)");
      ok = false;
    } else setNameError(undefined);
    const mail = email.trim();
    if (mail && !EMAIL_RE.test(mail)) {
      setEmailError("صيغة البريد غير صحيحة");
      ok = false;
    } else setEmailError(undefined);
    if (!ok) return;

    setSaving(true);
    try {
      await saveProfile({ name: name.trim(), email: mail });
      toast.success("تم حفظ الملف الشخصي");
    } catch {
      toast.error("تعذر حفظ الملف الشخصي");
    } finally {
      setSaving(false);
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

  const resetDemo = async () => {
    try {
      await resetDemoData();
      toast.success("تمت إعادة ضبط البيانات التجريبية");
    } catch {
      toast.error("تعذر إعادة ضبط البيانات التجريبية");
    }
  };

  const doClear = async () => {
    setClearing(true);
    try {
      await clearAllData();
      toast.success("تم مسح كل البيانات المحلية");
      setClearOpen(false);
    } catch {
      toast.error("تعذر مسح البيانات");
    } finally {
      setClearing(false);
    }
  };

  const listItems: Array<{ label: string; ready?: boolean; action?: () => void }> = [
    { label: "الملف الشخصي", ready: true, action: () => document.getElementById("profile-name")?.focus() },
    { label: "الإشعارات" },
    { label: "الأمان" },
    { label: "المظهر" },
    { label: "حول التطبيق", ready: true, action: () => setAboutOpen(true) },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Profile card */}
      <section id="profile" className="rounded-lg border border-line bg-card p-5 shadow-card" aria-labelledby="profile-heading">
        <div className="flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-full bg-navy text-lg font-extrabold text-white" aria-hidden="true">
            {initialsOf(profile.name)}
          </span>
          <div>
            <h2 id="profile-heading" className="text-lg font-extrabold">
              {profile.name}
            </h2>
            <p className="text-sm text-ink-3">{profile.email || "بدون بريد إلكتروني"}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="الاسم" htmlFor="profile-name" error={nameError} required>
            <input
              id="profile-name"
              type="text"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              className={`${inputCls} ${nameError ? "border-neg" : ""}`}
            />
          </Field>
          <Field label="البريد الإلكتروني (اختياري)" htmlFor="profile-email" error={emailError}>
            <input
              id="profile-email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputCls} ${emailError ? "border-neg" : ""}`}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Button type="button" onClick={save} loading={saving}>
            حفظ الملف الشخصي
          </Button>
        </div>
      </section>

      {/* Settings list */}
      <nav aria-label="أقسام الإعدادات" className="overflow-hidden rounded-lg border border-line bg-card">
        <ul className="divide-y divide-line">
          {listItems.map((item) => (
            <li key={item.label}>
              {item.ready ? (
                <button type="button" onClick={item.action} className="flex min-h-13 w-full items-center gap-3 px-4 text-start text-sm font-bold hover:bg-page">
                  <Icon name="chevronLeft" size={16} className="text-ink-3" />
                  {item.label}
                </button>
              ) : (
                <span className="flex min-h-13 w-full items-center gap-3 px-4 text-sm font-bold text-ink-3" aria-disabled="true">
                  <Icon name="chevronLeft" size={16} className="text-ink-3/50" />
                  {item.label}
                  <span className="ms-auto rounded-full bg-page px-2 py-0.5 text-[10px] font-extrabold">قريباً</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Two small preference cards */}
      <section aria-label="التفضيلات" className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-card p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-navy/8 text-navy">
              <Icon name="settings" size={16} />
            </span>
            <h3 className="text-sm font-extrabold">المظهر</h3>
          </div>
          <p className="mt-2 text-sm text-ink-2">فاتح فقط — الوضع الداكن قريباً.</p>
          <span className="mt-2 inline-block rounded-full bg-page px-2.5 py-1 text-xs font-bold text-ink-3">قريباً</span>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-cash-bg text-cash">
              <Icon name="info" size={16} />
            </span>
            <h3 className="text-sm font-extrabold">تفضيلات العرض</h3>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-ink-2">
            <li>
              العملة: <strong>جنيه مصري (EGP)</strong>
            </li>
            <li>
              التوقيت: <strong>محلي لهذا الجهاز</strong>
            </li>
            <li>
              الأرقام: <strong>لاتينية بفواصل الآلاف</strong>
            </li>
          </ul>
        </div>
      </section>

      {/* Data & storage — states the local-only limitation */}
      <section aria-labelledby="data-heading" className="rounded-lg border border-line bg-card p-5 shadow-card">
        <h2 id="data-heading" className="text-lg font-extrabold">
          البيانات والتخزين
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          CASHY يخزّن بياناتك محليًا في هذا المتصفح فقط (IndexedDB) — لا يوجد خادم ولا مزامنة. حذف بيانات المتصفح يعني
          حذف الدفتر بالكامل، لذا احتفظ بنسخة احتياطية من معلوماتك خارج التطبيق.
        </p>
        <p className="mt-2 text-sm text-ink-3">
          الحالي: <span className="bidi">{accounts.length}</span> حساب ·{" "}
          <span className="bidi">{operations.length}</span> عملية
          {isDemo ? " · وضع العرض التجريبي" : ""}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {isDemo ? (
            <Button type="button" variant="secondary" onClick={resetDemo}>
              <Icon name="restore" size={16} />
              إعادة ضبط البيانات التجريبية
            </Button>
          ) : (
            accounts.length === 0 &&
            operations.length === 0 && (
              <Button type="button" variant="secondary" onClick={loadPreview}>
                تحميل بيانات تجريبية (للعرض فقط)
              </Button>
            )
          )}
          <Button type="button" variant="danger" onClick={() => setClearOpen(true)}>
            مسح كل البيانات
          </Button>
        </div>
      </section>

      {accounts.length === 0 && operations.length === 0 && !isDemo && (
        <EmptyState
          icon="wallet"
          title="دفترك فارغ"
          description="ابدأ بإضافة أول حساب من صفحة الحسابات."
          action={
            <Link to="/accounts" className={buttonCls("primary")}>
              إضافة حساب
            </Link>
          }
        />
      )}

      {/* About dialog */}
      {aboutOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-navy/45" onClick={() => setAboutOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="about-title" className="relative w-full max-w-sm rounded-lg border border-line bg-card p-5 shadow-pop">
            <h2 id="about-title" className="text-lg font-extrabold">
              حول CASHY
            </h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2">
              <p>
                <strong>CASHY</strong> دفتر محاسبة شخصي لتدوين حسابات فيودافون كاش: سحب، إيداع، فلوس — بقيد مزدوج بسيط
                ومحلي.
              </p>
              <p className="font-bold text-neg">ليس تطبيقًا بنكيًا: لا يتصل بشبكة فودافون ولا ينفذ عمليات حقيقية.</p>
              <p>الإصدار 1.0 — تخزين محلي فقط (IndexedDB).</p>
            </div>
            <div className="mt-4">
              <Button type="button" onClick={() => setAboutOpen(false)}>
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={clearOpen}
        danger
        title="مسح كل البيانات؟"
        message="سيُحذف كل الحسابات والعمليات والملف الشخصي من هذا الجهاز نهائيًا. لا يمكن التراجع."
        confirmLabel="مسح نهائي"
        loading={clearing}
        onConfirm={doClear}
        onClose={() => setClearOpen(false)}
      />
    </div>
  );
}
