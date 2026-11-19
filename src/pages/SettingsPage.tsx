import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Button, buttonCls } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Field, inputCls } from "../components/Field";
import { Icon } from "../components/Icon";
import { LoadingBlock } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useAllOperations, useAccounts, useProfile } from "../hooks/useData";
import { useShopView } from "../hooks/useShop";
import { downloadBackup, parseBackup, restoreBackup, type AppBackup } from "../services/backupService";
import {
  downloadDriveBackup,
  getCloudBackupStatus,
  uploadCurrentBackupToDrive,
  type CloudBackupStatus,
} from "../services/cloudBackupClient";
import { hasCloudBackupKey, saveCloudBackupPassphrase } from "../services/cloudBackupCrypto";
import {
  chooseLocalDailyBackupFolder,
  getLocalDailyBackupStatus,
  requestLocalDailyBackupPermission,
  type LocalDailyBackupStatus,
} from "../services/localDailyBackup";
import { clearAllData, saveProfile } from "../services/settingsService";
import {
  getStoragePersistenceStatus,
  requestStoragePersistence,
  type StoragePersistenceStatus,
} from "../services/storagePersistence";
import { initialsOf } from "../utils/format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Settings (screen 8): profile, list items (unimplemented ones disabled), simple preference cards. */
export function SettingsPage() {
  const profile = useProfile();
  const accounts = useAccounts(true);
  const operations = useAllOperations();
  const shop = useShopView();
  const toast = useToast();
  const backupInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<AppBackup | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudBackupStatus | null>(null);
  const [cloudStatusError, setCloudStatusError] = useState<string | undefined>();
  const [encryptionConfigured, setEncryptionConfigured] = useState(false);
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [backupPassphraseConfirm, setBackupPassphraseConfirm] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [storageStatus, setStorageStatus] = useState<StoragePersistenceStatus | null>(null);
  const [storageBusy, setStorageBusy] = useState(false);
  const [localBackupStatus, setLocalBackupStatus] = useState<LocalDailyBackupStatus | null>(null);
  const [localBackupBusy, setLocalBackupBusy] = useState(false);
  const [localBackupStatusError, setLocalBackupStatusError] = useState<string | undefined>();
  const hasCloudCopy = Boolean(cloudStatus?.hasDriveBackup || cloudStatus?.hasSnapshot);

  const refreshCloudStatus = async () => {
    try {
      setCloudStatus(await getCloudBackupStatus());
      setCloudStatusError(undefined);
    } catch {
      setCloudStatusError("خدمة النسخ السحابي غير مهيأة أو غير متاحة حاليًا.");
    }
  };

  const refreshLocalBackupStatus = async () => {
    try {
      setLocalBackupStatus(await getLocalDailyBackupStatus());
      setLocalBackupStatusError(undefined);
    } catch {
      setLocalBackupStatusError("تعذر فحص مجلد النسخ المحلي.");
    }
  };

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
    }
  }, [profile]);

  useEffect(() => {
    void hasCloudBackupKey().then(setEncryptionConfigured).catch(() => {
      setCloudStatusError("تعذر قراءة إعداد مفتاح التشفير المحلي.");
    });
    void getStoragePersistenceStatus().then(setStorageStatus).catch(() => {
      setStorageStatus("unsupported");
    });
    void refreshLocalBackupStatus();
    void refreshCloudStatus();
    const handleCloudSync = () => { void refreshCloudStatus(); };
    const handleLocalBackup = () => { void refreshLocalBackupStatus(); };
    window.addEventListener("basata-cloud-backup-updated", handleCloudSync);
    window.addEventListener("basata-local-backup-folder-changed", handleLocalBackup);
    window.addEventListener("basata-local-backup-updated", handleLocalBackup);

    const driveResult = new URLSearchParams(window.location.search).get("drive");
    if (driveResult === "connected") {
      toast.success("تم ربط Google Drive");
      window.history.replaceState(null, "", window.location.pathname);
    } else if (driveResult === "error") {
      toast.error("تعذر ربط Google Drive؛ راجع إعدادات OAuth وحاول مرة أخرى.");
      window.history.replaceState(null, "", window.location.pathname);
    }
    return () => {
      window.removeEventListener("basata-cloud-backup-updated", handleCloudSync);
      window.removeEventListener("basata-local-backup-folder-changed", handleLocalBackup);
      window.removeEventListener("basata-local-backup-updated", handleLocalBackup);
    };
  }, []);

  if (!profile || !accounts || !operations || !shop) {
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

  const exportData = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      await downloadBackup();
      toast.success("تم تنزيل النسخة الاحتياطية");
    } catch {
      toast.error("تعذر تنزيل النسخة الاحتياطية");
    } finally {
      setBackupBusy(false);
    }
  };

  const enableCloudEncryption = async () => {
    if (backupPassphrase.length < 12) {
      toast.error("كلمة مرور النسخة يجب ألا تقل عن 12 حرفًا");
      return;
    }
    if (backupPassphrase !== backupPassphraseConfirm) {
      toast.error("تأكيد كلمة المرور غير مطابق");
      return;
    }
    setBackupBusy(true);
    try {
      await saveCloudBackupPassphrase(backupPassphrase);
      setEncryptionConfigured(true);
      setBackupPassphrase("");
      setBackupPassphraseConfirm("");
      toast.success("تم تفعيل تشفير النسخ على هذا الجهاز");
    } catch {
      toast.error("تعذر حفظ مفتاح التشفير على هذا الجهاز");
    } finally {
      setBackupBusy(false);
    }
  };

  const uploadCloudBackupNow = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      await uploadCurrentBackupToDrive();
      toast.success("تم رفع النسخة المشفّرة إلى Google Drive");
      await refreshCloudStatus();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      toast.error(
        code === "backup_encryption_not_configured"
          ? "فعّل تشفير النسخة أولًا"
          : code === "google_account_required"
            ? "اربط حساب Google Drive أولًا"
            : code === "cloud_snapshot_missing"
              ? "لا توجد نسخة بيانات لرفعها"
              : "تعذر رفع النسخة إلى Google Drive",
      );
    } finally {
      setBackupBusy(false);
    }
  };

  const prepareCloudRestore = async () => {
    if (backupBusy) return;
    if (!encryptionConfigured && !restorePassphrase) {
      toast.error("أدخل كلمة مرور النسخة لتشفيرها على هذا الجهاز");
      return;
    }
    setBackupBusy(true);
    try {
      const backup = await downloadDriveBackup(encryptionConfigured ? undefined : restorePassphrase);
      setPendingBackup(backup);
      setRestoreOpen(true);
      setEncryptionConfigured(true);
      setRestorePassphrase("");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      toast.error(
        code === "backup_passphrase_invalid"
          ? "كلمة مرور النسخة غير صحيحة"
          : code === "cloud_backup_not_found" || code === "drive_backup_not_found"
            ? "لا توجد نسخة سحابية بعد"
            : "تعذر تنزيل أو فك تشفير النسخة السحابية",
      );
    } finally {
      setBackupBusy(false);
    }
  };

  const enablePersistentStorage = async () => {
    setStorageBusy(true);
    try {
      const status = await requestStoragePersistence();
      setStorageStatus(status);
      if (status === "granted") toast.success("تم تثبيت مساحة التخزين لهذا الموقع");
      else if (status === "not-granted") toast.error("المتصفح لم يثبت التخزين؛ احتفظ بنسخة على Google Drive");
      else toast.error("هذا المتصفح لا يدعم تثبيت مساحة التخزين");
    } catch {
      toast.error("تعذر طلب تثبيت مساحة التخزين");
    } finally {
      setStorageBusy(false);
    }
  };

  const configureLocalBackup = async () => {
    setLocalBackupBusy(true);
    try {
      if (localBackupStatus?.permission === "prompt" || localBackupStatus?.permission === "denied") {
        const permission = await requestLocalDailyBackupPermission();
        if (permission !== "granted") throw new Error("local_backup_permission_denied");
      } else {
        await chooseLocalDailyBackupFolder();
      }
      await refreshLocalBackupStatus();
      toast.success("تم تفعيل النسخ المحلي اليومي");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const code = error instanceof Error ? error.message : "";
      toast.error(
        code === "local_backup_not_supported"
          ? "الحفظ التلقائي للمجلدات يحتاج Chrome أو Edge حديثًا"
          : code === "local_backup_permission_denied"
            ? "لم يتم منح إذن الكتابة إلى مجلد النسخ"
            : "تعذر إعداد النسخ المحلي",
      );
    } finally {
      setLocalBackupBusy(false);
    }
  };

  const chooseBackup = async (file?: File) => {
    if (!file) return;
    try {
      setPendingBackup(parseBackup(await file.text()));
      setRestoreOpen(true);
    } catch {
      toast.error("الملف تالف أو ليس نسخة احتياطية مدعومة");
    }
  };

  const doRestore = async () => {
    if (!pendingBackup || backupBusy) return;
    setBackupBusy(true);
    try {
      await downloadBackup();
      await restoreBackup(pendingBackup);
      setPendingBackup(null);
      setRestoreOpen(false);
      toast.success("تم استعادة النسخة الاحتياطية");
    } catch {
      toast.error("تعذرت الاستعادة؛ لم يتم اعتماد التغييرات غير المكتملة");
    } finally {
      setBackupBusy(false);
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
          <span className="grid size-14 place-items-center rounded-full bg-brand text-lg font-extrabold text-white" aria-hidden="true">
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
            <span className="grid size-8 place-items-center rounded-md bg-brand/8 text-brand">
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

      {/* Data & storage */}
      <section aria-labelledby="data-heading" className="rounded-lg border border-line bg-card p-5 shadow-card">
        <h2 id="data-heading" className="text-lg font-extrabold">
          البيانات والتخزين
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          البيانات الأساسية محفوظة في IndexedDB على جهازك. تفعيل التخزين الدائم يقلل حذفها تلقائيًا، لكنه لا يمنع مسح بيانات
          المتصفح أو تعطل الجهاز؛ لذلك اربط Google Drive وفعّل النسخ المشفّر.
        </p>
        <p className="mt-2 text-sm text-ink-3">
          الحالي: <span className="bidi">{accounts.length}</span> حساب ·{" "}
          <span className="bidi">{operations.length}</span> عملية ·{" "}
          <span className="bidi">{shop.totals.products}</span> منتج ·{" "}
          <span className="bidi">{shop.totals.receipts}</span> فاتورة ·{" "}
          <span className="bidi">{shop.returns.length}</span> مرتجع
        </p>

        <div className="mt-4 rounded-md border border-line bg-page p-4">
          <h3 className="font-extrabold">تثبيت التخزين على هذا الجهاز</h3>
          <p className="mt-1 text-sm text-ink-2">
            الحالة:{" "}
            <strong>
              {storageStatus === "granted"
                ? "التخزين الدائم مفعّل"
                : storageStatus === "not-granted"
                  ? "لم يوافق المتصفح بعد"
                  : storageStatus === "unsupported"
                    ? "غير مدعوم في هذا المتصفح"
                    : "جارٍ الفحص"}
            </strong>
            . هذا يقلل الإخلاء التلقائي، لكنه ليس بديلًا عن النسخ الاحتياطي.
          </p>
          <Button type="button" className="mt-3" variant="secondary" onClick={enablePersistentStorage} loading={storageBusy}>
            طلب تثبيت مساحة التخزين
          </Button>
        </div>

        <div className="mt-4 rounded-md border border-line bg-page p-4">
          <h3 className="font-extrabold">نسخة يومية على هذا الكمبيوتر</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            اختر مجلدًا مرة واحدة. أثناء فتح التطبيق، سيُنشئ ملفًا لكل يوم ويحدّث ملف اليوم مع تغيّر البيانات.
            المتصفح لا يستطيع تشغيل النسخ عندما يكون مغلقًا. الملفات بصيغة JSON وغير مشفّرة؛ اختر مجلدًا خاصًا.
          </p>
          <p className="mt-2 text-sm text-ink-3">
            الحالة:{" "}
            <strong>
              {localBackupStatus?.permission === "granted"
                ? "النسخ المحلي مفعّل"
                : localBackupStatus?.permission === "prompt"
                  ? "يحتاج إعادة منح الإذن"
                  : localBackupStatus?.permission === "denied"
                    ? "الإذن مرفوض"
                    : localBackupStatus?.permission === "unsupported"
                      ? "غير مدعوم في هذا المتصفح"
                      : localBackupStatus?.permission === "not-configured"
                        ? "لم يتم اختيار مجلد"
                        : "جارٍ الفحص"}
            </strong>
            {localBackupStatus?.lastBackupAtIso && (
              <> · آخر نسخة: {new Date(localBackupStatus.lastBackupAtIso).toLocaleString("ar-EG")}</>
            )}
          </p>
          {localBackupStatusError && <p role="alert" className="mt-2 text-sm font-semibold text-neg">{localBackupStatusError}</p>}
          <Button
            type="button"
            className="mt-3"
            variant="secondary"
            onClick={configureLocalBackup}
            loading={localBackupBusy}
            disabled={localBackupStatus?.permission === "unsupported"}
          >
            {localBackupStatus?.permission === "granted" ? "تغيير مجلد النسخ" : "اختيار مجلد النسخ"}
          </Button>
        </div>

        <div className="mt-4 rounded-md border border-line bg-page p-4">
          <h3 className="font-extrabold">نسخ أسبوعي مشفّر إلى Google Drive</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            المزامنة ترفع نسخة مشفّرة فقط إلى تخزين خاص على Vercel عند تغيّر البيانات، ثم تُرفع نسخة أسبوعية إلى Drive
            كل جمعة الساعة 10 مساءً بتوقيت القاهرة. مفتاح التشفير لا يغادر هذا المتصفح. احتفظ بكلمة المرور؛ لا يمكن استعادة
            النسخة بدونها.
          </p>

          {cloudStatusError && <p role="alert" className="mt-2 text-sm font-semibold text-neg">{cloudStatusError}</p>}
          {cloudStatus?.connected ? (
            <p className="mt-2 text-sm">
              حساب Google المرتبط: <strong dir="ltr">{cloudStatus.email}</strong>
            </p>
          ) : (
            <a href="/api/google/auth/start" className={`${buttonCls("secondary")} mt-3`}>
              ربط Google Drive
            </a>
          )}

          {!encryptionConfigured && !hasCloudCopy && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="كلمة مرور تشفير النسخة (12 حرفًا على الأقل)" htmlFor="backup-passphrase">
                <input
                  id="backup-passphrase"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={backupPassphrase}
                  onChange={(event) => setBackupPassphrase(event.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="تأكيد كلمة المرور" htmlFor="backup-passphrase-confirm">
                <input
                  id="backup-passphrase-confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={backupPassphraseConfirm}
                  onChange={(event) => setBackupPassphraseConfirm(event.target.value)}
                  className={inputCls}
                />
              </Field>
              <p className="text-xs text-ink-3 sm:col-span-2">
                كلمة المرور لا تُرسل إلى Vercel أو Google ولا يمكن تغييرها دون تنزيل النسخ القديمة وفك تشفيرها أولًا.
              </p>
              <Button type="button" onClick={enableCloudEncryption} loading={backupBusy} className="sm:col-span-2">
                تفعيل التشفير
              </Button>
            </div>
          )}

          {!encryptionConfigured && hasCloudCopy && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-bold text-warn">توجد نسخة مشفّرة. أدخل كلمة مرورها لاستعادتها على هذا الجهاز.</p>
              <Field label="كلمة مرور النسخة" htmlFor="restore-cloud-passphrase">
                <input
                  id="restore-cloud-passphrase"
                  type="password"
                  autoComplete="current-password"
                  minLength={12}
                  value={restorePassphrase}
                  onChange={(event) => setRestorePassphrase(event.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          {encryptionConfigured && (
            <p className="mt-3 text-sm font-bold text-pos">تشفير النسخة مفعّل على هذا الجهاز.</p>
          )}
          {cloudStatus?.lastSyncedAtIso && (
            <p className="mt-2 text-xs text-ink-3">
              آخر مزامنة مشفّرة: {new Date(cloudStatus.lastSyncedAtIso).toLocaleString("ar-EG")}
            </p>
          )}
          {cloudStatus?.lastDriveBackupAtIso && (
            <p className="mt-1 text-xs text-ink-3">
              آخر رفع إلى Drive: {new Date(cloudStatus.lastDriveBackupAtIso).toLocaleString("ar-EG")}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={uploadCloudBackupNow}
              loading={backupBusy}
              disabled={!encryptionConfigured || !cloudStatus?.connected}
            >
              نسخ الآن إلى Google Drive
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={prepareCloudRestore}
              loading={backupBusy}
              disabled={!cloudStatus?.connected || !hasCloudCopy}
            >
              استعادة نسخة Google Drive
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="primary" onClick={exportData} loading={backupBusy}>
            تنزيل نسخة احتياطية
          </Button>
          <Button type="button" variant="secondary" onClick={() => backupInput.current?.click()} disabled={backupBusy}>
            استعادة نسخة احتياطية
          </Button>
          <input
            ref={backupInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="اختيار ملف النسخة الاحتياطية"
            onChange={(event) => {
              void chooseBackup(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button type="button" variant="danger" onClick={() => setClearOpen(true)}>
            مسح كل البيانات
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          النسخة اليدوية غير مشفّرة وتحفظ على جهازك. النسخة إلى Drive مشفّرة بكلمة المرور التي اخترتها.
        </p>
      </section>

      {accounts.length === 0 && operations.length === 0 && shop.totals.products === 0 && shop.totals.receipts === 0 && (
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
          <div className="absolute inset-0 bg-brand/45" onClick={() => setAboutOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="about-title" className="relative w-full max-w-sm rounded-lg border border-line bg-card p-5 shadow-pop">
            <h2 id="about-title" className="text-lg font-extrabold">
              حول بساطه تك
            </h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2">
              <p>
                <strong>بساطه تك</strong> دفتر محاسبة شخصي لتدوين حسابات فيودافون كاش: سحب، إيداع، فلوس — بقيد مزدوج بسيط
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
        message="سيُحذف كل الحسابات والعمليات وبيانات المتجر والملف الشخصي من هذا الجهاز نهائيًا. لا يمكن التراجع."
        confirmLabel="مسح نهائي"
        loading={clearing}
        onConfirm={doClear}
        onClose={() => setClearOpen(false)}
      />

      <ConfirmDialog
        open={restoreOpen}
        danger
        title="استعادة النسخة الاحتياطية؟"
        message="ستستبدل النسخة كل البيانات الحالية، بما فيها بيانات المتجر. سيبدأ تنزيل نسخة من بياناتك الحالية قبل الاستعادة كإجراء احتياطي."
        confirmLabel="تنزيل واستعادة"
        loading={backupBusy}
        onConfirm={doRestore}
        onClose={() => {
          if (!backupBusy) {
            setRestoreOpen(false);
            setPendingBackup(null);
          }
        }}
      />
    </div>
  );
}
