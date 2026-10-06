import { describe, it, expect } from "vitest";
import {
  canonicalJson,
  parseS3Origin,
  planTemplateSync,
  referencedUrls,
  templateDiff,
  type TemplateRow,
} from "./sync-templates";

const FROM = "https://old.s3.eu-west-2.amazonaws.com";
const TO = "https://new.s3.eu-central-1.amazonaws.com";
const OPTS = { from: FROM, to: TO };

function row(overrides: Partial<TemplateRow> = {}): TemplateRow {
  return {
    id: 1,
    slug: "roses",
    name: "Roses",
    productSlug: "order-of-service",
    previewImageUrl: `${FROM}/template-previews/roses.png`,
    placeholderPortrait: null,
    layout: [{ elements: [{ type: "image", src: `${FROM}/templates/backgrounds/roses-rose.jpg` }] }],
    draftLayout: null,
    status: "published",
    sortOrder: 3,
    updatedAt: new Date("2026-10-05T10:00:00Z"),
    categories: ["floral", "classic"],
    ...overrides,
  };
}

/** The same template as the target holds it after a sync: URLs on the new bucket. */
function synced(source: TemplateRow, overrides: Partial<TemplateRow> = {}): TemplateRow {
  const swap = (v: unknown) => (v == null ? v : JSON.parse(JSON.stringify(v).split(`${FROM}/`).join(`${TO}/`)));
  return {
    ...source,
    id: 99,
    previewImageUrl: swap(source.previewImageUrl),
    layout: swap(source.layout),
    draftLayout: swap(source.draftLayout),
    ...overrides,
  };
}

describe("canonicalJson", () => {
  it("ignores key order at every depth", () => {
    expect(canonicalJson([{ a: 1, b: { c: 2, d: 3 } }])).toBe(canonicalJson([{ b: { d: 3, c: 2 }, a: 1 }]));
  });

  it("keeps array order significant", () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});

describe("templateDiff", () => {
  it("treats a row whose only difference is the bucket as unchanged", () => {
    const source = row();
    expect(templateDiff(source, synced(source), FROM, TO)).toEqual([]);
  });

  it("treats a layout handed back with reordered keys as unchanged", () => {
    const source = row();
    const target = synced(source, {
      layout: [{ elements: [{ src: `${TO}/templates/backgrounds/roses-rose.jpg`, type: "image" }] }],
    });
    expect(templateDiff(source, target, FROM, TO)).toEqual([]);
  });

  it("names each field that differs, category order included", () => {
    const source = row();
    const target = synced(source, { status: "draft", categories: ["classic", "floral"], draftLayout: [] });
    expect(templateDiff(source, target, FROM, TO)).toEqual(["status", "draftLayout", "categories"]);
  });
  it("carries a pinned stand-in portrait, which the thumbnail is drawn with", () => {
    const source = row({ placeholderPortrait: "portrait-5" });
    expect(templateDiff(source, synced(source, { placeholderPortrait: null }), FROM, TO)).toEqual([
      "placeholderPortrait",
    ]);
  });
});

describe("planTemplateSync", () => {
  it("creates new slugs, updates changed ones and leaves target-only templates alone", () => {
    const same = row({ slug: "same" });
    const changed = row({ slug: "changed", name: "Changed" });
    const fresh = row({ slug: "fresh" });
    const plan = planTemplateSync(
      [same, changed, fresh],
      [synced(same), synced(changed, { name: "Old name" }), synced(row({ slug: "prod-only" }))],
      OPTS,
    );
    expect(plan.create.map((r) => r.slug)).toEqual(["fresh"]);
    expect(plan.update).toEqual([{ row: changed, diffs: ["name"] }]);
    expect(plan.unchanged).toBe(1);
    expect(plan.targetOnly).toEqual(["prod-only"]);
  });

  it("holds back a template edited in the target since the source changed, unless forced", () => {
    const source = row();
    const target = synced(source, { name: "Edited in prod", updatedAt: new Date("2026-10-06T00:00:00Z") });
    expect(planTemplateSync([source], [target], OPTS).targetNewer.map((t) => t.row.slug)).toEqual(["roses"]);
    expect(planTemplateSync([source], [target], { ...OPTS, force: true }).update.map((u) => u.row.slug)).toEqual([
      "roses",
    ]);
  });

  it("only considers the slugs asked for", () => {
    const plan = planTemplateSync([row({ slug: "a" }), row({ slug: "b" })], [], { ...OPTS, only: ["b"] });
    expect(plan.create.map((r) => r.slug)).toEqual(["b"]);
  });
});

describe("referencedUrls", () => {
  it("finds the preview and every URL nested in both layouts, once each", () => {
    const urls = referencedUrls(
      row({
        draftLayout: [{ elements: [{ src: "/elements/divider.png" }, { src: `${FROM}/template-previews/roses.png` }] }],
      }),
    );
    expect(urls.sort()).toEqual(
      [`${FROM}/template-previews/roses.png`, `${FROM}/templates/backgrounds/roses-rose.jpg`, "/elements/divider.png"].sort(),
    );
  });

  it("ignores text and colours", () => {
    expect(referencedUrls(row({ layout: [{ elements: [{ text: "In loving memory", color: "#5e3a8c" }] }] }))).toEqual([
      `${FROM}/template-previews/roses.png`,
    ]);
  });
});

describe("parseS3Origin", () => {
  it("reads the bucket and region from a virtual-hosted origin", () => {
    expect(parseS3Origin(TO)).toEqual({ bucket: "new", region: "eu-central-1" });
  });

  it("rejects anything else", () => {
    expect(() => parseS3Origin("https://cdn.example.com")).toThrow();
  });
});
