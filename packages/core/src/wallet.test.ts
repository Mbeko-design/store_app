import { describe, expect, it } from "vitest";
import { WALLET_IDS, seedAccounts } from "./accounts.js";
import { accountBalances, entryTotals, validateEntry } from "./ledger.js";
import {
  buildOpening,
  buildOperation,
  buildWalletDeposit,
  buildWalletReceive,
  buildWalletSend,
  buildWalletWithdraw,
  cashInForSend,
  cashOutForReceive,
  walletAfter,
} from "./wallet.js";

const device = "dev-1";

describe("buildWalletSend", () => {
  it("cash +amount+fee, float −amount, income +fee", () => {
    const e = buildWalletSend({ wallet: "vodafone", amount: 50000, fee: 1000, deviceId: device, customer: "أحمد" });
    expect(() => validateEntry(e)).not.toThrow();
    const t = entryTotals(e);
    expect(t.debits).toBe(t.credits);
    expect(t.debits).toBe(51000);
    expect(e.meta.cashDelta).toBe(51000);
    expect(e.meta.walletDelta).toBe(-50000);
    expect(e.meta.customer).toBe("أحمد");
  });

  it("works with zero fee (no income posting)", () => {
    const e = buildWalletSend({ wallet: "instapay", amount: 10000, deviceId: device });
    expect(e.postings).toHaveLength(2);
    expect(() => validateEntry(e)).not.toThrow();
  });

  it("rejects non-positive amounts and bad fees", () => {
    expect(() => buildWalletSend({ wallet: "vodafone", amount: 0, deviceId: device })).toThrow("amount_must_be_positive");
    expect(() => buildWalletSend({ wallet: "vodafone", amount: 100, fee: -5, deviceId: device })).toThrow("fee_invalid");
    expect(() => buildWalletSend({ wallet: "vodafone", amount: 100.5, deviceId: device })).toThrow("amount_must_be_positive");
  });
});

describe("buildWalletReceive", () => {
  it("float +amount, cash −(amount−fee), income +fee", () => {
    const e = buildWalletReceive({ wallet: "orange", amount: 30000, fee: 500, deviceId: device });
    expect(() => validateEntry(e)).not.toThrow();
    const t = entryTotals(e);
    expect(t.debits).toBe(30000);
    expect(e.meta.cashDelta).toBe(-29500);
    expect(e.meta.walletDelta).toBe(30000);
  });

  it("fee equal to amount → no cash posting", () => {
    const e = buildWalletReceive({ wallet: "eand", amount: 1000, fee: 1000, deviceId: device });
    expect(e.postings).toHaveLength(2);
    expect(() => validateEntry(e)).not.toThrow();
  });

  it("rejects fee greater than amount", () => {
    expect(() => buildWalletReceive({ wallet: "eand", amount: 1000, fee: 1001, deviceId: device })).toThrow("fee_exceeds_amount");
  });
});

describe("deposit / withdraw (own float top-up)", () => {
  it("deposit moves cash → float", () => {
    const e = buildWalletDeposit({ wallet: "vodafone", amount: 200000, deviceId: device });
    expect(() => validateEntry(e)).not.toThrow();
    expect(e.meta.cashDelta).toBe(-200000);
    expect(e.meta.walletDelta).toBe(200000);
  });

  it("withdraw moves float → cash", () => {
    const e = buildWalletWithdraw({ wallet: "instapay", amount: 75000, deviceId: device });
    expect(() => validateEntry(e)).not.toThrow();
    expect(e.meta.cashDelta).toBe(75000);
    expect(e.meta.walletDelta).toBe(-75000);
  });

  it("deposit then withdraw nets to zero on every account", () => {
    const d = buildWalletDeposit({ wallet: "orange", amount: 12300, deviceId: device });
    const w = buildWalletWithdraw({ wallet: "orange", amount: 12300, deviceId: device });
    expect(d.postings).toEqual([...w.postings].reverse().map((p) => ({ accountId: p.accountId, debit: p.credit, credit: p.debit })));
  });
});

describe("opening balances", () => {
  it("funds an asset from equity", () => {
    const e = buildOpening({ accountId: "cash_drawer", amount: 500000, deviceId: device, note: "بدء العمل" });
    expect(() => validateEntry(e)).not.toThrow();
    expect(e.kind).toBe("opening");
    expect(e.postings).toEqual([
      { accountId: "cash_drawer", debit: 500000, credit: 0 },
      { accountId: "opening_balance", debit: 0, credit: 500000 },
    ]);
  });

  it("rejects non-positive amounts and missing account", () => {
    expect(() => buildOpening({ accountId: "cash_drawer", amount: 0, deviceId: device })).toThrow("amount_must_be_positive");
    expect(() => buildOpening({ accountId: "", amount: 100, deviceId: device })).toThrow("missing_account");
  });

  it("opening + operations preserve the grand invariant", () => {
    const accounts = seedAccounts();
    const entries = [
      buildOpening({ accountId: "wallet_vodafone", amount: 1000000, deviceId: device }),
      buildWalletSend({ wallet: "vodafone", amount: 45000, fee: 1500, deviceId: device }),
      buildWalletReceive({ wallet: "instapay", amount: 12000, fee: 300, deviceId: device }),
    ];
    const b = accountBalances(accounts, entries);
    const assetIds = accounts.filter((a) => a.type === "asset").map((a) => a.id);
    const incomeIds = accounts.filter((a) => a.type === "income").map((a) => a.id);
    const equityIds = accounts.filter((a) => a.type === "equity").map((a) => a.id);
    const assets = assetIds.reduce((s, id) => s + (b[id] ?? 0), 0);
    const income = incomeIds.reduce((s, id) => s + (b[id] ?? 0), 0);
    const equity = equityIds.reduce((s, id) => s + (b[id] ?? 0), 0);
    expect(assets - income - equity).toBe(0);
  });
});

describe("buildOperation dispatcher", () => {
  it("routes wallet kinds with a wallet", () => {
    const e = buildOperation({ kind: "wallet_send", wallet: "orange", amount: 1000, fee: 100, deviceId: device });
    expect(e.kind).toBe("wallet_send");
    expect(() => validateEntry(e)).not.toThrow();
  });

  it("routes opening with an account", () => {
    const e = buildOperation({ kind: "opening", accountId: "cash_drawer", amount: 25000, deviceId: device });
    expect(e.kind).toBe("opening");
    expect(() => validateEntry(e)).not.toThrow();
  });

  it("fails loudly on missing targets", () => {
    expect(() => buildOperation({ kind: "wallet_send", amount: 100, deviceId: device })).toThrow("missing_wallet");
    expect(() => buildOperation({ kind: "opening", amount: 100, deviceId: device })).toThrow("missing_account");
  });
});

describe("walletAfter + helpers", () => {
  it("projects float after each kind", () => {
    expect(walletAfter("wallet_send", 100000, 30000)).toBe(70000);
    expect(walletAfter("wallet_withdraw", 100000, 30000)).toBe(70000);
    expect(walletAfter("wallet_receive", 100000, 30000)).toBe(130000);
    expect(walletAfter("wallet_deposit", 100000, 30000)).toBe(130000);
    expect(walletAfter("reversal", 100000, 30000)).toBe(100000);
  });

  it("cash helpers", () => {
    expect(cashInForSend(50000, 1000)).toBe(51000);
    expect(cashOutForReceive(30000, 500)).toBe(29500);
  });
});

describe("every wallet × every op stays balanced", () => {
  it("matrix", () => {
    for (const wallet of WALLET_IDS) {
      for (const build of [buildWalletSend, buildWalletReceive, buildWalletDeposit, buildWalletWithdraw]) {
        const e = build({ wallet, amount: 12345, fee: 678, deviceId: device });
        const t = entryTotals(e);
        expect(t.debits).toBe(t.credits);
        expect(() => validateEntry(e)).not.toThrow();
      }
    }
  });
});
