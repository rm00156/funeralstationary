import { describe, expect, it } from "vitest";
import {
  changesContent,
  createSerialQueue,
  isDesignConflict,
  parseExpectedRevision,
} from "./designRevision";

describe("parseExpectedRevision", () => {
  it("leaves an absent revision unset, so an older tab still saves", () => {
    expect(parseExpectedRevision(undefined)).toBeUndefined();
    expect(parseExpectedRevision(null)).toBeUndefined();
  });

  it("accepts a non-negative integer", () => {
    expect(parseExpectedRevision(0)).toBe(0);
    expect(parseExpectedRevision(17)).toBe(17);
  });

  it("refuses anything else rather than saving unguarded", () => {
    for (const value of [-1, 1.5, "3", Number.NaN, {}, true]) {
      expect(parseExpectedRevision(value)).toBe("invalid");
    }
  });
});

describe("isDesignConflict", () => {
  it("recognises the revision guard's refusal", () => {
    expect(isDesignConflict(409, { reason: "conflict", error: "…" })).toBe(true);
  });

  it("does not mistake other failures for a conflict", () => {
    expect(isDesignConflict(409, { reason: "blocked" })).toBe(false);
    expect(isDesignConflict(400, { reason: "conflict" })).toBe(false);
    expect(isDesignConflict(409, null)).toBe(false);
    expect(isDesignConflict(409, "conflict")).toBe(false);
  });
});

describe("createSerialQueue", () => {
  it("starts each task only once the one before has finished", async () => {
    const enqueue = createSerialQueue();
    const events: string[] = [];
    let finishFirst!: () => void;
    const first = enqueue(async () => {
      events.push("first started");
      await new Promise<void>((resolve) => (finishFirst = resolve));
      events.push("first finished");
      return 1;
    });
    const second = enqueue(async () => {
      events.push("second started");
      return 2;
    });

    await Promise.resolve();
    expect(events).toEqual(["first started"]);
    finishFirst();
    expect(await Promise.all([first, second])).toEqual([1, 2]);
    expect(events).toEqual(["first started", "first finished", "second started"]);
  });

  it("carries on after a task fails, and hands that failure only to its own caller", async () => {
    const enqueue = createSerialQueue();
    const failed = enqueue(() => Promise.reject(new Error("offline")));
    const next = enqueue(async () => "saved");
    await expect(failed).rejects.toThrow("offline");
    await expect(next).resolves.toBe("saved");
  });
});

describe("changesContent", () => {
  it("counts the pages, the page count and paper, and the template as content", () => {
    expect(changesContent({ doc: { pages: [] } })).toBe(true);
    expect(changesContent({ spec: { pagesOptionId: "p8", paperId: "silk" } })).toBe(true);
    expect(changesContent({ templateId: "lily" })).toBe(true);
  });

  it("leaves a rename alone, so it never clashes with an open editor", () => {
    expect(changesContent({})).toBe(false);
    expect(changesContent({ doc: undefined, spec: undefined, templateId: undefined })).toBe(false);
  });
});
