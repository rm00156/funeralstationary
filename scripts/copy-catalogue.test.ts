import { describe, it, expect } from "vitest";
import { rewriteValue } from "./copy-catalogue";

const FROM = "https://old.s3.eu-west-2.amazonaws.com";
const TO = "https://new.s3.eu-west-2.amazonaws.com";

describe("rewriteValue", () => {
  it("rewrites a URL column", () => {
    expect(rewriteValue(`${FROM}/template-previews/a.png`, FROM, TO)).toBe(`${TO}/template-previews/a.png`);
  });

  it("rewrites every URL inside a parsed JSON layout and returns it as JSON text", () => {
    const layout = [{ elements: [{ src: `${FROM}/templates/backgrounds/x.jpg` }, { src: `${FROM}/designs/y.png` }] }];
    const out = rewriteValue(layout, FROM, TO) as string;
    expect(JSON.parse(out)).toEqual([
      { elements: [{ src: `${TO}/templates/backgrounds/x.jpg` }, { src: `${TO}/designs/y.png` }] },
    ]);
  });

  it("doesn't touch a bucket whose name merely starts the same", () => {
    const other = "https://old.s3.eu-west-2.amazonaws.com-other/a.png";
    expect(rewriteValue(other, FROM, TO)).toBe(other);
  });

  it("passes non-text values through untouched", () => {
    const when = new Date("2026-09-28T00:00:00Z");
    expect(rewriteValue(when, FROM, TO)).toBe(when);
    expect(rewriteValue(42, FROM, TO)).toBe(42);
    expect(rewriteValue(null, FROM, TO)).toBe(null);
  });
});
