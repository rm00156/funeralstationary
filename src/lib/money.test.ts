import { describe, expect, it } from "vitest";
import { penceToPoundsInput, poundsToPence } from "@/lib/money";

describe("poundsToPence", () => {
  it("converts pounds-and-pence strings exactly", () => {
    expect(poundsToPence("32.99")).toBe(3299);
    expect(poundsToPence("2.2")).toBe(220);
    expect(poundsToPence("10")).toBe(1000);
    expect(poundsToPence("0")).toBe(0);
    expect(poundsToPence("0.05")).toBe(5);
  });

  it("tolerates whitespace and a leading £", () => {
    expect(poundsToPence(" £32.99 ")).toBe(3299);
  });

  it("rejects malformed input rather than rounding it", () => {
    expect(poundsToPence("")).toBeNull();
    expect(poundsToPence("1.999")).toBeNull();
    expect(poundsToPence("-5")).toBeNull();
    expect(poundsToPence("ten")).toBeNull();
    expect(poundsToPence("1,000")).toBeNull();
    expect(poundsToPence(".99")).toBeNull();
    expect(poundsToPence("1.")).toBeNull();
  });
});

describe("penceToPoundsInput", () => {
  it("round-trips with poundsToPence", () => {
    expect(penceToPoundsInput(3299)).toBe("32.99");
    expect(penceToPoundsInput(0)).toBe("0.00");
    expect(penceToPoundsInput(5)).toBe("0.05");
    expect(poundsToPence(penceToPoundsInput(220))).toBe(220);
  });
});
