import { describe, expect, it } from "vitest";
import { formatEgp, parseEgpInput, piastresToInput, toPiastres } from "./money.js";

describe("money", () => {
  it("converts EGP to integer piastres without float drift", () => {
    expect(toPiastres(0.1) + toPiastres(0.2)).toBe(30); // 0.1+0.2 = 0.30000000000000004 in floats
    expect(toPiastres(50.5)).toBe(5050);
    expect(toPiastres(1250)).toBe(125000);
    expect(toPiastres(0)).toBe(0);
  });

  it("rejects non-finite input", () => {
    expect(() => toPiastres(NaN)).toThrow();
    expect(() => toPiastres(Infinity)).toThrow();
  });

  it("parses user input (latin + arabic digits)", () => {
    expect(parseEgpInput("1250.50")).toBe(125050);
    expect(parseEgpInput("1,250.5")).toBe(125050);
    expect(parseEgpInput("1٬250٫50")).toBe(125050);
    expect(parseEgpInput("١٢٥٠٫٥٠")).toBe(125050);
    expect(parseEgpInput("1250")).toBe(125000);
    expect(parseEgpInput("")).toBeNull();
    expect(parseEgpInput("abc")).toBeNull();
    expect(parseEgpInput("12.3.4")).toBeNull();
  });

  it("formats for both languages", () => {
    const ar = formatEgp(5050, "ar");
    const en = formatEgp(5050, "en");
    expect(ar).toContain("٥"); // Arabic-Indic digits
    expect(en).toMatch(/EGP|ج\.م/);
    expect(piastresToInput(5050)).toBe("50.50");
    expect(piastresToInput(-250)).toBe("-2.50");
  });
});
