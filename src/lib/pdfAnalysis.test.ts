// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  PDFDocument,
  PDFHexString,
  PDFName,
  StandardFonts,
  TextRenderingMode,
  beginText,
  concatTransformationMatrix,
  degrees,
  drawObject,
  endText,
  popGraphicsState,
  pushGraphicsState,
  setFontAndSize,
  setTextRenderingMode,
  showText,
  type PDFPage,
} from "pdf-lib";

import { analysePdf } from "@/lib/pdfAnalysis";

const MM = 72 / 25.4;

async function build(make: (doc: PDFDocument) => Promise<void> | void): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  await make(doc);
  return doc.save();
}

async function analysed(make: (doc: PDFDocument) => Promise<void> | void) {
  const result = await analysePdf(await build(make));
  if (!result.ok) throw new Error(`expected a readable PDF, got ${result.reason}`);
  return result;
}

/** A grey image `px` pixels square, registered for use on `page`. */
function imageOn(doc: PDFDocument, page: PDFPage, px: number) {
  const ref = doc.context.register(
    doc.context.stream(new Uint8Array(px * px), {
      Type: "XObject",
      Subtype: "Image",
      Width: px,
      Height: px,
      ColorSpace: "DeviceGray",
      BitsPerComponent: 8,
    }),
  );
  return { ref, key: page.node.newXObject("Im", ref) };
}

function drawAt(page: PDFPage, key: PDFName, sizePt: number) {
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(sizePt, 0, 0, sizePt, 20, 20),
    drawObject(key),
    popGraphicsState(),
  );
}

describe("analysePdf — page sizes", () => {
  it("reads a plain page's size in millimetres", async () => {
    const result = await analysed((doc) => {
      doc.addPage([148 * MM, 210 * MM]);
    });
    expect(result.pageCount).toBe(1);
    expect(result.pages[0].mediaMm).toEqual({ w: 148, h: 210 });
    expect(result.pages[0].trimMm).toBeUndefined();
  });

  it("reads a declared trim box and the bleed around it", async () => {
    const result = await analysed((doc) => {
      const page = doc.addPage([154 * MM, 216 * MM]);
      page.setTrimBox(3 * MM, 3 * MM, 148 * MM, 210 * MM);
      page.setBleedBox(0, 0, 154 * MM, 216 * MM);
    });
    expect(result.pages[0].trimMm).toEqual({ w: 148, h: 210 });
    expect(result.pages[0].bleedMm).toBe(3);
  });

  it("measures bleed to the page edge when no bleed box is set", async () => {
    const result = await analysed((doc) => {
      const page = doc.addPage([170 * MM, 232 * MM]);
      page.setTrimBox(11 * MM, 11 * MM, 148 * MM, 210 * MM);
    });
    expect(result.pages[0].bleedMm).toBe(11);
  });

  it("reports a rotated page the way it displays", async () => {
    const result = await analysed((doc) => {
      doc.addPage([210 * MM, 148 * MM]).setRotation(degrees(90));
    });
    expect(result.pages[0].mediaMm).toEqual({ w: 148, h: 210 });
  });

  it("counts every page", async () => {
    const result = await analysed((doc) => {
      for (let i = 0; i < 8; i += 1) doc.addPage([148 * MM, 210 * MM]);
    });
    expect(result.pageCount).toBe(8);
    expect(result.pages).toHaveLength(8);
    expect(result.uncheckedPages).toBeUndefined();
  });

  it("names a page whose content can't be decoded, rather than calling it checked", async () => {
    const result = await analysed((doc) => {
      doc.addPage([148 * MM, 210 * MM]);
      const broken = doc.addPage([148 * MM, 210 * MM]);
      const stream = doc.context.flateStream("q Q");
      stream.dict.set(PDFName.of("Filter"), PDFName.of("NoSuchDecode"));
      broken.node.set(PDFName.of("Contents"), doc.context.register(stream));
    });
    expect(result.pageCount).toBe(2);
    expect(result.uncheckedPages).toEqual([2]);
  });
});

describe("analysePdf — photos", () => {
  it("works out an image's resolution from the size it is drawn", async () => {
    const result = await analysed((doc) => {
      const page = doc.addPage([148 * MM, 210 * MM]);
      // 300 pixels across two inches.
      drawAt(page, imageOn(doc, page, 300).key, 144);
    });
    expect(result.pages[0].minImagePpi).toBe(150);
  });

  it("keeps the lowest resolution on a page", async () => {
    const result = await analysed((doc) => {
      const page = doc.addPage([148 * MM, 210 * MM]);
      drawAt(page, imageOn(doc, page, 600).key, 144);
      drawAt(page, imageOn(doc, page, 200).key, 144);
    });
    expect(result.pages[0].minImagePpi).toBe(100);
  });

  it("ignores small ornaments and stretched flat-colour images", async () => {
    const result = await analysed((doc) => {
      const page = doc.addPage([148 * MM, 210 * MM]);
      drawAt(page, imageOn(doc, page, 40).key, 15 * MM); // a 15mm ornament
      drawAt(page, imageOn(doc, page, 8).key, 140 * MM); // a gradient fill
    });
    expect(result.pages[0].minImagePpi).toBeUndefined();
  });

  it("follows an image into a scaled form XObject", async () => {
    const result = await analysed((doc) => {
      const page = doc.addPage([148 * MM, 210 * MM]);
      const { ref: imageRef } = imageOn(doc, page, 300);
      const form = doc.context.register(
        doc.context.stream("q 144 0 0 144 0 0 cm /Pic Do Q", {
          Type: "XObject",
          Subtype: "Form",
          BBox: [0, 0, 500, 500],
          Matrix: [0.5, 0, 0, 0.5, 0, 0],
          Resources: { XObject: { Pic: imageRef } },
        }),
      );
      page.pushOperators(drawObject(page.node.newXObject("Fm", form)));
    });
    // 300 pixels drawn at 2in, halved by the form: 1in.
    expect(result.pages[0].minImagePpi).toBe(300);
  });

  it("skips inline image data rather than reading it as operators", async () => {
    const result = await analysed((doc) => {
      const page = doc.addPage([148 * MM, 210 * MM]);
      const { key } = imageOn(doc, page, 300);
      const content = doc.context.register(
        doc.context.stream(
          `BI /W 2 /H 2 /CS /G /BPC 8 ID \u0001Q 9 0 0 9 0 0 cm\u0002 EI\nq 144 0 0 144 10 10 cm /${key.decodeText()} Do Q`,
        ),
      );
      page.node.addContentStream(content);
    });
    expect(result.pages[0].minImagePpi).toBe(150);
  });
});

describe("analysePdf — fonts", () => {
  it("lists a font that draws text but isn't in the file", async () => {
    const result = await analysed(async (doc) => {
      const page = doc.addPage([148 * MM, 210 * MM]);
      page.drawText("In loving memory", { font: await doc.embedFont(StandardFonts.Helvetica) });
    });
    expect(result.unembeddedFonts).toEqual(["Helvetica"]);
  });

  it("doesn't count invisible text, which can't print", async () => {
    const result = await analysed(async (doc) => {
      const page = doc.addPage([148 * MM, 210 * MM]);
      page.pushOperators(setTextRenderingMode(TextRenderingMode.Invisible));
      page.drawText("OCR layer", { font: await doc.embedFont(StandardFonts.Helvetica) });
    });
    expect(result.unembeddedFonts).toEqual([]);
  });

  it("accepts an embedded font, named without its subset prefix", async () => {
    const result = await analysed((doc) => {
      const page = doc.addPage([148 * MM, 210 * MM]);
      const fontFile = doc.context.register(doc.context.stream(new Uint8Array(4)));
      const font = doc.context.register(
        doc.context.obj({
          Type: "Font",
          Subtype: "TrueType",
          BaseFont: "ABCDEF+Newsreader",
          FontDescriptor: doc.context.obj({ Type: "FontDescriptor", FontFile2: fontFile }),
        }),
      );
      page.node.setFontDictionary(PDFName.of("F9"), font);
      page.pushOperators(beginText(), setFontAndSize("F9", 12), showText(PDFHexString.of("00")), endText());
    });
    expect(result.unembeddedFonts).toEqual([]);
  });
});

describe("analysePdf — files it can't use", () => {
  it("refuses something that isn't a PDF", async () => {
    expect(await analysePdf(new TextEncoder().encode("GIF89a not a pdf"))).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });

  it("refuses a truncated PDF", async () => {
    expect(await analysePdf(new TextEncoder().encode("%PDF-1.7\n1 0 obj << /Type"))).toMatchObject({
      ok: false,
    });
  });
});
