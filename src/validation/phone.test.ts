import { describe, expect, it } from "vitest";
import { EGYPTIAN_MOBILE_RE, normalizePhone, validatePhone } from "./phone";

describe("normalizePhone", () => {
  it("strips spaces, dashes and country code", () => {
    expect(normalizePhone("+20 0101 234 5678")).toBe("01012345678");
    expect(normalizePhone("0101-234-5678")).toBe("01012345678");
    expect(normalizePhone("2001012345678")).toBe("01012345678");
  });
});

describe("validatePhone", () => {
  it("accepts valid Egyptian mobile numbers (010/011/012/015)", () => {
    for (const p of ["01012345678", "01112345678", "01212345678", "01512345678"]) {
      expect(validatePhone(p)).toBeNull();
      expect(EGYPTIAN_MOBILE_RE.test(p)).toBe(true);
    }
  });

  it("rejects empty, short, landline and wrong-prefix numbers", () => {
    expect(validatePhone("")).toBeTruthy();
    expect(validatePhone("0101234567")).toBeTruthy();
    expect(validatePhone("01312345678")).toBeTruthy();
    expect(validatePhone("0212345678")).toBeTruthy();
    expect(validatePhone("abcdefghijk")).toBeTruthy();
  });
});
