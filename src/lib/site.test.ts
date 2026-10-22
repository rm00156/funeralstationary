import { describe, expect, it } from "vitest";

import { PRICING } from "@/db/seedCatalogue";
import { CUTOFF_TOKEN, ORDER_CUTOFF, withOrderCutoff } from "@/lib/site";

/** A clock time like "10am", "11:30am" or "2 pm". */
const CLOCK_TIME = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i;

describe("withOrderCutoff", () => {
  it("writes the site's cut-off wherever a note asks for it", () => {
    expect(withOrderCutoff(`Order by ${CUTOFF_TOKEN} for next working day`)).toBe(
      `Order by ${ORDER_CUTOFF} for next working day`,
    );
  });

  it("leaves a note without the token alone", () => {
    expect(withOrderCutoff("Free — 3 to 5 working days once printed")).toBe(
      "Free — 3 to 5 working days once printed",
    );
  });
});

describe("seeded delivery notes", () => {
  // A note that types its own time drifts from ORDER_CUTOFF — the 10am/11am
  // clash the delivery section showed.
  it("never name a cut-off time of their own", () => {
    for (const pricing of Object.values(PRICING)) {
      for (const option of pricing.delivery) {
        expect(option.note, option.id).not.toMatch(CLOCK_TIME);
      }
    }
  });

  it("show the site's cut-off on the next-day option", () => {
    for (const pricing of Object.values(PRICING)) {
      const nextDay = pricing.delivery.find((option) => option.id === "next-day");
      expect(nextDay && withOrderCutoff(nextDay.note)).toContain(ORDER_CUTOFF);
    }
  });
});
