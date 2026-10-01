import { describe, expect, it } from "vitest";
import { accountBalance } from "./balance";
import { computeDeficit, computeDeficitFromOps } from "./deficit";
import { DEFAULT_MONTHLY_LIMIT_PIASTRES, remainingLimit } from "./limit";
import { emptyTotals, totalsByType, totalsForAccount } from "./totals";
import { CASH_ACCOUNT_ID, type Account, type Operation, type OperationType } from "./types";

/* ---------- fixtures ---------- */

let seq = 0;
function op(
  accountId: string,
  type: OperationType,
  amountEgp: number,
  occurredAtIso = "2026-10-01T10:00:00.000Z",
  note?: string,
): Operation {
  seq += 1;
  return {
    id: `op-${seq}`,
    accountId,
    type,
    amountPiastres: amountEgp * 100,
    occurredAtIso,
    note,
    createdAtIso: occurredAtIso,
  };
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    phone: "01012345678",
    limitMonthlyPiastres: DEFAULT_MONTHLY_LIMIT_PIASTRES,
    openingBalancePiastres: 0,
    createdAtIso: "2026-01-01T00:00:00.000Z",
    archivedAtIso: null,
    ...overrides,
  };
}

/* ---------- totals: every op counted exactly once ---------- */

describe("totalsByType", () => {
  it("sums each operation exactly once, under its own type", () => {
    const ops = [
      op("a", "withdraw", 100),
      op("a", "deposit", 50),
      op(CASH_ACCOUNT_ID, "cash", 40),
      op("b", "withdraw", 10),
      op("b", "deposit", 70),
    ];
    const t = totalsByType(ops);
    expect(t).toEqual({ withdraw: 11_000, deposit: 12_000, cash: 4_000 });
    // no double-counting: grand sum equals the sum of the three buckets
    const grandSum = ops.reduce((s, o) => s + o.amountPiastres, 0);
    expect(t.withdraw + t.deposit + t.cash).toBe(grandSum);
  });

  it("handles an empty list", () => {
    expect(totalsByType([])).toEqual(emptyTotals());
  });

  it("totalsForAccount never leaks other accounts' operations", () => {
    const ops = [op("a", "deposit", 10), op("b", "deposit", 999), op(CASH_ACCOUNT_ID, "cash", 7)];
    expect(totalsForAccount(ops, "a")).toEqual({ withdraw: 0, deposit: 1_000, cash: 0 });
    expect(totalsForAccount(ops, "b").deposit).toBe(99_900);
    expect(totalsForAccount(ops, CASH_ACCOUNT_ID).cash).toBe(700);
  });

  it("totals stay consistent when the same list is reused", () => {
    const ops = [op("a", "withdraw", 110), op("a", "deposit", 120), op(CASH_ACCOUNT_ID, "cash", 40)];
    expect(totalsByType(ops)).toEqual({ withdraw: 11_000, deposit: 12_000, cash: 4_000 });
  });
});

/* ---------- deficit meter: negative / zero / positive ---------- */

describe("computeDeficit", () => {
  it("negative difference → deficit (عجز)", () => {
    const r = computeDeficit({ cash: 10_000, deposit: 20_000, withdraw: 100_000 });
    expect(r.inflowsPiastres).toBe(30_000);
    expect(r.outflowsPiastres).toBe(100_000);
    expect(r.differencePiastres).toBe(-70_000);
    expect(r.status).toBe("deficit");
  });

  it("zero difference → balanced (تمام)", () => {
    const r = computeDeficit({ cash: 400_000, deposit: 300_000, withdraw: 700_000 });
    expect(r.differencePiastres).toBe(0);
    expect(r.status).toBe("balanced");
  });

  it("positive difference → surplus (زيادة)", () => {
    const r = computeDeficit({ cash: 400_000, deposit: 430_000, withdraw: 430_000 });
    expect(r.differencePiastres).toBe(400_000);
    expect(r.status).toBe("surplus");
  });

  it("rule = (فلوس + إيداع) − سحب computed from raw operations", () => {
    const ops = [
      op(CASH_ACCOUNT_ID, "cash", 400),
      op("a", "deposit", 430),
      op("a", "withdraw", 430),
    ];
    const r = computeDeficitFromOps(ops);
    expect(r.differencePiastres).toBe(40_000); // 40,000 EGP
    expect(r.status).toBe("surplus");
  });

  it("empty history is balanced at zero", () => {
    expect(computeDeficitFromOps([])).toEqual({
      inflowsPiastres: 0,
      outflowsPiastres: 0,
      differencePiastres: 0,
      status: "balanced",
    });
  });
});

/* ---------- balance: opening vs historical operations ---------- */

describe("accountBalance", () => {
  it("starts from the opening balance and applies history", () => {
    const a = account({ openingBalancePiastres: 100_000 }); // 1,000 EGP
    const ops = [op("acc-1", "deposit", 500), op("acc-1", "withdraw", 200)];
    expect(accountBalance(a, ops)).toBe(100_000 + 50_000 - 20_000);
  });

  it("modifying the opening balance shifts the derived balance (history untouched)", () => {
    const ops = [op("acc-1", "deposit", 500)];
    const before = accountBalance(account({ openingBalancePiastres: 100_000 }), ops);
    const after = accountBalance(account({ openingBalancePiastres: 150_000 }), ops);
    expect(after - before).toBe(50_000);
    expect(ops[0]!.amountPiastres).toBe(50_000); // history unchanged
  });

  it("no opening balance → pure transaction-derived balance", () => {
    const ops = [op("acc-1", "deposit", 100), op("acc-1", "withdraw", 30)];
    expect(accountBalance(account(), ops)).toBe(7_000);
  });

  it("cash (فلوس) operations never change a wallet balance", () => {
    const ops = [op(CASH_ACCOUNT_ID, "cash", 999), op("acc-1", "cash", 100)];
    expect(accountBalance(account(), ops)).toBe(0);
  });

  it("no double-counting across accounts sharing one operation array", () => {
    const ops = [
      op("acc-1", "deposit", 100),
      op("acc-2", "deposit", 200),
      op(CASH_ACCOUNT_ID, "cash", 300),
    ];
    const a1 = account({ id: "acc-1" });
    const a2 = account({ id: "acc-2" });
    expect(accountBalance(a1, ops)).toBe(10_000);
    expect(accountBalance(a2, ops)).toBe(20_000);
    // sum of account balances equals Σ opening + Σ account-scoped net movement
    expect(accountBalance(a1, ops) + accountBalance(a2, ops)).toBe(30_000);
  });
});

/* ---------- remaining limit ---------- */

describe("remainingLimit", () => {
  const now = new Date("2026-10-15T12:00:00.000Z");

  it("monthly limit minus withdrawals of the current month", () => {
    const a = account(); // 40,000 EGP default
    const ops = [op("acc-1", "withdraw", 5_000, "2026-10-02T10:00:00.000Z")];
    const s = remainingLimit(a, ops, now);
    expect(s.limitPiastres).toBe(4_000_000);
    expect(s.usedPiastres).toBe(500_000);
    expect(s.remainingPiastres).toBe(3_500_000);
    expect(s.exceeds).toBe(false);
  });

  it("resets monthly: last month's withdrawals do not count", () => {
    const a = account();
    const ops = [op("acc-1", "withdraw", 39_000, "2026-09-28T10:00:00.000Z")];
    const s = remainingLimit(a, ops, now);
    expect(s.usedPiastres).toBe(0);
    expect(s.remainingPiastres).toBe(DEFAULT_MONTHLY_LIMIT_PIASTRES);
  });

  it("only withdrawals count (deposits/cash are ignored)", () => {
    const a = account();
    const ops = [
      op("acc-1", "deposit", 99_999, "2026-10-01T10:00:00.000Z"),
      op(CASH_ACCOUNT_ID, "cash", 99_999, "2026-10-01T10:00:00.000Z"),
    ];
    expect(remainingLimit(a, ops, now).usedPiastres).toBe(0);
  });

  it("going over the limit yields negative remaining and exceeds=true", () => {
    const a = account({ limitMonthlyPiastres: 100_000 }); // 1,000 EGP
    const ops = [op("acc-1", "withdraw", 1_500, "2026-10-05T10:00:00.000Z")];
    const s = remainingLimit(a, ops, now);
    expect(s.remainingPiastres).toBe(-50_000);
    expect(s.exceeds).toBe(true);
  });
});
