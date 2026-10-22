import { describe, expect, it } from "vitest";

import { CUTOFF_TOKEN, ORDER_CUTOFF, withOrderCutoff } from "@/lib/site";

describe("withOrderCutoff", () => {
  it("writes the site's cut-off wherever a note asks for it", () => {
    expect(withOrderCutoff(`Order by ${CUTOFF_TOKEN} on a working day`)).toBe(
      `Order by ${ORDER_CUTOFF} on a working day`,
    );
  });

  it("leaves a note without the token alone", () => {
    expect(withOrderCutoff("Free — 3 to 5 working days once printed")).toBe(
      "Free — 3 to 5 working days once printed",
    );
  });
});
