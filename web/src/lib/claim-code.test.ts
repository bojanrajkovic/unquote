import { describe, it, expect } from "vitest";
import { validateClaimCode } from "./claim-code.js";

describe("validateClaimCode", () => {
  it("accepts standard valid codes", () => {
    expect(validateClaimCode("AMBER-HAWK-7842")).toBe("AMBER-HAWK-7842");
    expect(validateClaimCode("CIPHER-TURING-0001")).toBe("CIPHER-TURING-0001");
    expect(validateClaimCode("A-B-0000")).toBe("A-B-0000");
  });

  it("trims whitespace and uppercases before validating", () => {
    expect(validateClaimCode("  AMBER-HAWK-7842  ")).toBe("AMBER-HAWK-7842");
    expect(validateClaimCode("amber-hawk-7842")).toBe("AMBER-HAWK-7842");
  });

  it("rejects codes missing the digit suffix", () => {
    expect(validateClaimCode("AMBER-HAWK")).toBeNull();
    expect(validateClaimCode("AMBER-HAWK-78")).toBeNull(); // too short
    expect(validateClaimCode("AMBER-HAWK-78420")).toBeNull(); // too long
  });

  it("rejects codes with wrong separator count", () => {
    expect(validateClaimCode("AMBERHAWK-7842")).toBeNull(); // missing middle hyphen
    expect(validateClaimCode("AMBER-HAWK-CODE-7842")).toBeNull(); // too many parts
  });

  it("rejects codes with digits in word parts", () => {
    expect(validateClaimCode("AMB3R-HAWK-7842")).toBeNull();
    expect(validateClaimCode("AMBER-H4WK-7842")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(validateClaimCode("")).toBeNull();
    expect(validateClaimCode("   ")).toBeNull();
  });
});
