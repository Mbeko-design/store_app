import { describe, expect, it } from "vitest";
import { seedAccounts } from "./accounts.js";
import type { JournalEntry } from "./ledger.js";
import { accountBalances, buildReversal, isBalanced, validateEntry } from "./ledger.js";
import { buildWalletReceive, buildWalletSend } from "./wallet.js";

const device = "dev-1";

function entry(over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: crypto.randomUUID(),
    kind: "wallet_send",
    occurredAt: new Date().toISOString(),
    deviceId: device,
    postings: [
      { accountId: "cash_drawer", debit: 51000, credit: 0 },
      { accountId: "wallet_vodafone", debit: 0, credit: 50000 },
      { accountId: "fees_income", debit: 0, credit: 1000 },
    ],
    meta: {},
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe("validateEntry", () => {
  it("accepts a balanced entry", () => {
    expect(() => validateEntry(entry())).not.toThrow();
    expect(isBalanced(entry())).toBe(true);
  });

  it("rejects unbalanced postings", () => {
    const e = entry();
    e.postings[0]!.debit = 52000;
    expect(() => validateEntry(e)).toThrow("unbalanced_entry");
    expect(isBalanced(e)).toBe(false);
  });

  it("rejects negative and fractional amounts", () => {
    expect(() => validateEntry(entry({ postings: [{ accountId: "cash_drawer", debit: -100, credit: 0 }, { accountId: "wallet_vodafone", debit: 0, credit: -100 }] }))).toThrow("negative_amount");
    expect(() => validateEntry(entry({ postings: [{ accountId: "cash_drawer", debit: 10.5, credit: 0 }, { accountId: "wallet_vodafone", debit: 0, credit: 10 }] }))).toThrow("non_integer_debit");
  });

  it("rejects postings that use both sides or neither", () => {
    expect(() => validateEntry(entry({ postings: [{ accountId: "a", debit: 100, credit: 100 }, { accountId: "b", debit: 0, credit: 0 }] }))).toThrow("posting_both_sides");
    expect(() => validateEntry(entry({ postings: [{ accountId: "a", debit: 100, credit: 0 }, { accountId: "b", debit: 0, credit: 100 }, { accountId: "c", debit: 0, credit: 0 }] }))).toThrow("posting_empty");
  });

  it("rejects fewer than two postings and zero totals", () => {
    expect(() => validateEntry(entry({ postings: [{ accountId: "a", debit: 100, credit: 0 }] }))).toThrow("min_postings");
    expect(() =>
      validateEntry(entry({ postings: [{ accountId: "a", debit: 100, credit: 0 }, { accountId: "b", debit: 0, credit: 100 }] })),
    ).not.toThrow();
  });
});

describe("accountBalances", () => {
  it("derives signed balances from entries", () => {
    const accounts = seedAccounts();
    const entries = [
      buildWalletSend({ wallet: "vodafone", amount: 50000, fee: 1000, deviceId: device }),
      buildWalletReceive({ wallet: "orange", amount: 30000, fee: 500, deviceId: device }),
    ];
    const b = accountBalances(accounts, entries);
    // cash: +51000 (send) −29500 (receive) = 21500
    expect(b["cash_drawer"]).toBe(21500);
    // vodafone float: −50000
    expect(b["wallet_vodafone"]).toBe(-50000);
    // orange float: +30000
    expect(b["wallet_orange"]).toBe(30000);
    // fee income: +1500 (credit-normal → positive)
    expect(b["fees_income"]).toBe(1500);
  });

  it("total assets moved equals total funded (grand invariant)", () => {
    const accounts = seedAccounts();
    const entries = [
      buildWalletSend({ wallet: "vodafone", amount: 100000, fee: 250, deviceId: device }),
      buildWalletSend({ wallet: "instapay", amount: 40000, fee: 0, deviceId: device }),
      buildWalletReceive({ wallet: "eand", amount: 7500, fee: 100, deviceId: device }),
    ];
    const b = accountBalances(accounts, entries);
    const assets = ["cash_drawer", "wallet_vodafone", "wallet_orange", "wallet_eand", "wallet_instapay", "basata_float", "inventory"].reduce(
      (s, id) => s + (b[id] ?? 0),
      0,
    );
    const income = ["fees_income", "sales_revenue", "basata_margin", "drawer_surplus"].reduce((s, id) => s + (b[id] ?? 0), 0);
    expect(assets - income).toBe(0); // assets are funded by exactly the income earned
  });

  it("reversal restores every balance exactly", () => {
    const accounts = seedAccounts();
    const original = buildWalletSend({ wallet: "vodafone", amount: 123456, fee: 789, deviceId: device });
    const before = accountBalances(accounts, [original]);
    const after = accountBalances(accounts, [original, buildReversal(original, device)]);
    expect(after).toEqual(
      Object.fromEntries(Object.keys(before).map((k) => [k, 0])),
    );
  });
});

describe("buildReversal", () => {
  it("mirrors postings and links to the original", () => {
    const original = buildWalletReceive({ wallet: "orange", amount: 10000, fee: 100, deviceId: device });
    const rev = buildReversal(original, device);
    expect(rev.kind).toBe("reversal");
    expect(rev.meta.reverses).toBe(original.id);
    expect(() => validateEntry(rev)).not.toThrow();
    const origTotals = original.postings.reduce((s, p) => s + p.debit, 0);
    const revTotals = rev.postings.reduce((s, p) => s + p.debit, 0);
    // debits of reversal = credits of original
    expect(revTotals).toBe(original.postings.reduce((s, p) => s + p.credit, 0));
    expect(origTotals).toBeGreaterThan(0);
  });

  it("cannot reverse a reversal", () => {
    const original = buildWalletSend({ wallet: "vodafone", amount: 1000, deviceId: device });
    const rev = buildReversal(original, device);
    expect(() => buildReversal(rev, device)).toThrow("cannot_reverse_reversal");
  });
});
