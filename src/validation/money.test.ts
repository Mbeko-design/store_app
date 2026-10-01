import { describe, expect, it } from "vitest";
import { parseAmountInput } from "./money";

describe("parseAmountInput", () => {
  it("parses plain and grouped English numbers", () => {
    expect(parseAmountInput("12500")).toEqual({ ok: true, piastres: 1_250_000 });
    expect(parseAmountInput("12,500")).toEqual({ ok: true, piastres: 1_250_000 });
    expect(parseAmountInput("12500.50")).toEqual({ ok: true, piastres: 1_250_050 });
  });

  it("parses Arabic-Indic digits and separators", () => {
    expect(parseAmountInput("١٢٥٠٠")).toEqual({ ok: true, piastres: 1_250_000 });
    expect(parseAmountInput("12٫50")).toEqual({ ok: true, piastres: 1_250 });
  });

  it("rejects empty / invalid / zero / negative input", () => {
    expect(parseAmountInput("").ok).toBe(false);
    expect(parseAmountInput("abc").ok).toBe(false);
    expect(parseAmountInput("0").ok).toBe(false);
    expect(parseAmountInput("-5").ok).toBe(false);
    expect(parseAmountInput("0.001").ok).toBe(false); // rounds to 0 piastres
  });
});
