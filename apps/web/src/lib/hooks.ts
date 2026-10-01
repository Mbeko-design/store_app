import { useEffect, useState, useSyncExternalStore } from "react";
import { getSyncState, subscribeSync } from "./sync";
import { pendingCount } from "../db/repo";
import { useLiveQuery } from "dexie-react-hooks";

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function useSyncStatus() {
  const state = useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
  const pending = useLiveQuery(() => pendingCount(), [], 0);
  const online = useOnline();
  return { ...state, pending, online };
}
