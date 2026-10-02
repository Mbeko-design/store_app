import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { accountBalance, remainingLimit, type Account, type DeficitResult, type Operation } from "../accounting";
import { computeDeficitFromOps, totalsByType } from "../accounting";
import { allAccounts, allOperations } from "../services/db";
import { listOperations, type OperationFilters } from "../services/operationsService";
import { getProfile, isDemoMode } from "../services/settingsService";
import type { ProfileRow } from "../services/db";

/**
 * Data hooks: glue between IndexedDB and the accounting service.
 * They call the accounting functions ONCE and pass plain results to components —
 * components never compute money math themselves.
 */

/** true while the first live query has not resolved yet → show skeletons. */
export function useLoading(value: unknown): boolean {
  return value === undefined;
}

export function useAccounts(includeArchived = false): Account[] | undefined {
  return useLiveQuery(() => allAccounts(includeArchived), [includeArchived]);
}

export function useAccount(id: string | undefined): Account | undefined {
  return useLiveQuery(async () => (id ? await allAccounts(true).then((l) => l.find((a) => a.id === id)) : undefined), [id]);
}

export function useAllOperations(): Operation[] | undefined {
  return useLiveQuery(() => allOperations(), []);
}

export function useFilteredOperations(filters: OperationFilters): Operation[] | undefined {
  const key = JSON.stringify(filters);
  return useLiveQuery(() => listOperations(filters), [key]);
}

/** An account enriched with accounting results (balance, limit, totals). */
export interface AccountView {
  account: Account;
  balancePiastres: number;
  limit: ReturnType<typeof remainingLimit>;
  totals: ReturnType<typeof totalsByType>;
}

/** Global view: everything at once — used by dashboard / summary / deficit pages. */
export interface LedgerView {
  accounts: Account[];
  archivedAccounts: Account[];
  operations: Operation[];
  totals: ReturnType<typeof totalsByType>;
  deficit: DeficitResult;
  views: AccountView[]; // active accounts, balance/limit/totals computed per account
  archivedViews: AccountView[]; // same, for archived accounts (restore lists)
}

export function useLedger(): LedgerView | undefined {
  const data = useLiveQuery(async () => {
    const [accounts, operations] = await Promise.all([allAccounts(true), allOperations()]);
    return { accounts, operations };
  }, []);

  return useMemo(() => {
    if (!data) return undefined;
    const active = data.accounts.filter((a) => !a.archivedAtIso);
    const archived = data.accounts.filter((a) => a.archivedAtIso);
    const now = new Date();
    const viewOf = (account: Account): AccountView => ({
      account,
      balancePiastres: accountBalance(account, data.operations),
      limit: remainingLimit(account, data.operations, now),
      totals: totalsByType(data.operations.filter((o) => o.accountId === account.id)),
    });
    return {
      accounts: active,
      archivedAccounts: archived,
      operations: data.operations,
      totals: totalsByType(data.operations),
      deficit: computeDeficitFromOps(data.operations),
      views: active.map(viewOf),
      archivedViews: archived.map(viewOf),
    };
  }, [data]);
}

export function useProfile(): ProfileRow | undefined {
  return useLiveQuery(() => getProfile(), []);
}

/** Single account + its accounting view (balance/limit/totals) — for the details page. */
export type AccountViewState = { status: "loading" } | { status: "missing" } | { status: "ready"; view: AccountView };

export function useAccountView(id: string | undefined): AccountViewState {
  const data = useLiveQuery(async () => {
    if (!id) return null;
    const [accounts, operations] = await Promise.all([allAccounts(true), allOperations()]);
    const account = accounts.find((a) => a.id === id);
    if (!account) return null; // definitive: not found
    const own = operations.filter((o) => o.accountId === id);
    const now = new Date();
    return {
      account,
      balancePiastres: accountBalance(account, operations),
      limit: remainingLimit(account, operations, now),
      totals: totalsByType(own),
    } satisfies AccountView;
  }, [id]);

  if (data === undefined) return { status: "loading" };
  if (data === null) return { status: "missing" };
  return { status: "ready", view: data };
}

/** True while the app is running with clearly-marked demo data (banner/reset). */
export function useDemoMode(): boolean | undefined {
  return useLiveQuery(() => isDemoMode(), []);
}

/** matchMedia helper for responsive rendering (tables vs lists on mobile). */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 767px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}
