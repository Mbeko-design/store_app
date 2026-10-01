import { describe, expect, it } from "vitest";
import type { Account } from "../accounting/types";
import { validateAccountForm, validateOperationForm } from "./forms";

const acc = (id: string, phone: string): Account => ({
  id,
  phone,
  limitMonthlyPiastres: 4_000_000,
  openingBalancePiastres: 0,
  createdAtIso: "2026-01-01T00:00:00.000Z",
  archivedAtIso: null,
});

describe("validateAccountForm", () => {
  const good = { phone: "01012345678", label: "خزنة المحل", limitEgp: "40,000", openingEgp: "1,000" };

  it("accepts a valid form and converts to piastres", () => {
    const { errors, values } = validateAccountForm(good, []);
    expect(errors).toEqual({});
    expect(values).toEqual({ phone: "01012345678", limitPiastres: 4_000_000, openingPiastres: 100_000, label: "خزنة المحل" });
  });

  it("flags duplicate phone numbers (unless it's the same account being edited)", () => {
    const existing = [acc("a1", "01012345678")];
    expect(validateAccountForm(good, existing).errors.phone).toMatch(/مسجل بالفعل/);
    expect(validateAccountForm(good, existing, "a1").errors).toEqual({});
  });

  it("reports field errors for bad phone and bad limit", () => {
    const r = validateAccountForm({ ...good, phone: "123", limitEgp: "abc" }, []);
    expect(r.errors.phone).toBeTruthy();
    expect(r.errors.limitEgp).toBeTruthy();
    expect(r.values).toBeNull();
  });

  it("empty opening balance defaults to 0", () => {
    const r = validateAccountForm({ ...good, openingEgp: "" }, []);
    expect(r.errors).toEqual({});
    expect(r.values?.openingPiastres).toBe(0);
  });
});

describe("validateOperationForm", () => {
  const accounts = [acc("a1", "01012345678"), { ...acc("a2", "01112345678"), archivedAtIso: "2026-01-01T00:00:00.000Z" }];
  const base = { type: "withdraw" as const, source: "a1", amount: "500", when: "2026-10-02T14:30", note: "" };

  it("accepts a valid withdrawal", () => {
    const { errors, value } = validateOperationForm(base, accounts);
    expect(errors).toEqual({});
    expect(value).toEqual({
      type: "withdraw",
      accountId: "a1",
      amountPiastres: 50_000,
      occurredAtIso: new Date("2026-10-02T14:30").toISOString(), // local input → UTC ISO
      note: "",
    });
  });

  it("rejects cash source for سحب/إيداع", () => {
    for (const type of ["withdraw", "deposit"] as const) {
      const r = validateOperationForm({ ...base, type, source: "cash" }, accounts);
      expect(r.errors.source).toBeTruthy();
      expect(r.value).toBeNull();
    }
  });

  it("allows cash source for فلوس", () => {
    const r = validateOperationForm({ ...base, type: "cash", source: "cash" }, accounts);
    expect(r.errors).toEqual({});
    expect(r.value?.accountId).toBe("cash");
  });

  it("rejects archived accounts and unknown sources", () => {
    expect(validateOperationForm({ ...base, source: "a2" }, accounts).errors.source).toMatch(/مؤرشف/);
    expect(validateOperationForm({ ...base, source: "nope" }, accounts).errors.source).toBeTruthy();
  });

  it("requires type, amount and datetime", () => {
    const r = validateOperationForm({ type: "", source: "a1", amount: "", when: "", note: "" }, accounts);
    expect(r.errors.type).toBeTruthy();
    expect(r.errors.amount).toBeTruthy();
    expect(r.errors.when).toBeTruthy();
    expect(r.value).toBeNull();
  });
});
