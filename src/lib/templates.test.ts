import { describe, expect, it } from "vitest";

import { homeDesignPicks, type Template } from "./templates";

const design = (id: string, ...categories: string[]): Template => ({
  id,
  name: id,
  categories,
  productId: "order-of-service",
  image: `/templates/${id}/cover.png`,
});

const pick = (templates: Template[], heroIds: string[], count = 3) =>
  homeDesignPicks(templates, { categoryId: "simple", heroIds, count }).map((t) => t.id);

describe("homeDesignPicks", () => {
  it("shows the category's designs, in catalogue order, ahead of the rest", () => {
    const templates = [
      design("lilac", "floral"),
      design("gentle", "classic", "simple"),
      design("jamaican", "colourful"),
      design("quiet", "simple"),
      design("sage", "simple"),
    ];
    expect(pick(templates, [])).toEqual(["gentle", "quiet", "sage"]);
  });

  it("fills a short category with the other designs", () => {
    const templates = [design("lilac", "floral"), design("gentle", "simple"), design("rose")];
    expect(pick(templates, [])).toEqual(["gentle", "lilac", "rose"]);
  });

  it("skips the hero's designs while there are others to show", () => {
    const templates = [
      design("gentle", "simple"),
      design("lilac", "floral"),
      design("quiet", "simple"),
      design("sage", "simple"),
      design("violet", "simple"),
    ];
    expect(pick(templates, ["gentle", "lilac"])).toEqual(["quiet", "sage", "violet"]);
  });

  it("repeats a hero design rather than show a short grid", () => {
    const templates = [
      design("gentle", "simple"),
      design("lilac", "floral"),
      design("quiet", "simple"),
      design("rose"),
    ];
    // Both simple designs (one of them the hero's) come before the rest.
    expect(pick(templates, ["gentle", "lilac"])).toEqual(["quiet", "gentle", "rose"]);
    expect(pick(templates, ["gentle", "lilac"], 6)).toEqual(["quiet", "gentle", "rose", "lilac"]);
  });

  it("shows nothing for a product with no designs", () => {
    expect(pick([], [])).toEqual([]);
  });
});
