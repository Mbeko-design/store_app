export type StoragePersistenceStatus = "granted" | "not-granted" | "unsupported";

export async function getStoragePersistenceStatus(): Promise<StoragePersistenceStatus> {
  if (!navigator.storage?.persisted) return "unsupported";
  return (await navigator.storage.persisted()) ? "granted" : "not-granted";
}

export async function requestStoragePersistence(): Promise<StoragePersistenceStatus> {
  if (!navigator.storage?.persist) return "unsupported";
  return (await navigator.storage.persist()) ? "granted" : "not-granted";
}
