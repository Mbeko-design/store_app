import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "./Toast";
import { createBackup } from "../services/backupService";
import { getCloudBackupStatus, syncEncryptedBackup } from "../services/cloudBackupClient";
import { hasCloudBackupKey } from "../services/cloudBackupCrypto";
import { getLocalDailyBackupStatus, writeDailyLocalBackup } from "../services/localDailyBackup";
import type { AppBackup } from "../services/backupService";

export function BackupSyncBridge() {
  const backup = useLiveQuery(() => createBackup(), []);
  const toast = useToast();
  const initialized = useRef(false);
  const latestBackup = useRef<AppBackup | undefined>(undefined);
  const failed = useRef(false);
  const syncQueue = useRef(Promise.resolve());
  const localWriteQueue = useRef(Promise.resolve());
  const localFailure = useRef(false);
  const [localFolderReady, setLocalFolderReady] = useState(false);
  const [localFolderRevision, setLocalFolderRevision] = useState(0);

  useEffect(() => {
    let active = true;
    const refreshLocalFolder = () => {
      void getLocalDailyBackupStatus().then((status) => {
        if (active) setLocalFolderReady(status.permission === "granted");
      }).catch(() => {
        if (active) setLocalFolderReady(false);
      });
    };
    const onFolderChanged = () => {
      setLocalFolderRevision((revision) => revision + 1);
      refreshLocalFolder();
    };

    refreshLocalFolder();
    window.addEventListener("basata-local-backup-folder-changed", onFolderChanged);
    window.addEventListener("focus", refreshLocalFolder);
    return () => {
      active = false;
      window.removeEventListener("basata-local-backup-folder-changed", onFolderChanged);
      window.removeEventListener("focus", refreshLocalFolder);
    };
  }, []);

  useEffect(() => {
    if (!localFolderReady) return;
    const timer = window.setInterval(() => {
      if (latestBackup.current) void enqueueLocalBackup(latestBackup.current);
    }, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [localFolderReady]);

  useEffect(() => {
    if (backup) latestBackup.current = backup;
    if (!backup || !localFolderReady) return;
    const timer = window.setTimeout(() => {
      void enqueueLocalBackup(backup).catch(() => {
        if (!localFailure.current) {
          localFailure.current = true;
          toast.error("تعذر حفظ النسخة المحلية؛ تحقّق من إذن المجلد ومساحة القرص.");
        }
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [backup, localFolderReady, localFolderRevision, toast]);

  useEffect(() => {
    latestBackup.current = backup;
    if (!backup) return;
    if (!initialized.current) {
      initialized.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      void enqueueSync(backup).catch(() => {
        if (!failed.current) {
          failed.current = true;
          toast.error("تعذر مزامنة النسخة المشفّرة؛ تحقّق من الاتصال ومن ربط Google Drive.");
        }
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [backup, toast]);

  useEffect(() => {
    const onOnline = () => {
      if (latestBackup.current) {
        void enqueueSync(latestBackup.current).catch(() => {
          if (!failed.current) {
            failed.current = true;
            toast.error("تعذر مزامنة النسخة المشفّرة؛ تحقّق من الاتصال ومن ربط Google Drive.");
          }
        });
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [toast]);

  function enqueueSync(currentBackup: AppBackup): Promise<void> {
    const task = syncQueue.current.catch(() => undefined).then(() => syncIfConnected(currentBackup));
    syncQueue.current = task;
    return task;
  }

  function enqueueLocalBackup(currentBackup: AppBackup): Promise<void> {
    const task = localWriteQueue.current.catch(() => undefined).then(() => writeDailyLocalBackup(currentBackup));
    localWriteQueue.current = task;
    void task.then(() => {
      localFailure.current = false;
    }).catch(() => {
      if (!localFailure.current) {
        localFailure.current = true;
        toast.error("تعذر حفظ النسخة المحلية؛ تحقّق من إذن المجلد ومساحة القرص.");
      }
    });
    return task;
  }

  async function syncIfConnected(currentBackup: AppBackup): Promise<void> {
    if (!(await hasCloudBackupKey())) return;
    const status = await getCloudBackupStatus();
    if (!status.connected) return;
    await syncEncryptedBackup(currentBackup);
    failed.current = false;
  }

  return null;
}
