import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PageCanvas, StaticPage } from "@/components/PageCanvas";
import type { DesignPage, ImageElement } from "@/lib/designEditor";

afterEach(cleanup);

const photo: ImageElement = {
  id: "photo",
  type: "image",
  src: "https://example.com/mum.jpg",
  shape: "oval",
  x: 30,
  y: 20,
  w: 40,
  h: 30,
  crop: { x: 20, y: 80, zoom: 2 },
};

const pageWith = (element: ImageElement): DesignPage => ({ id: "p1", elements: [element] });

function renderCanvas(adjustingId: string | null) {
  const onStartDrag = vi.fn();
  const { container } = render(
    <PageCanvas
      page={pageWith(photo)}
      zoom={1}
      showCut={false}
      showSafe={false}
      selectedId="photo"
      editingId={null}
      adjustingId={adjustingId}
      onSelect={() => {}}
      onStartDrag={onStartDrag}
      onStartEdit={() => {}}
      onEditText={() => {}}
      onEndEdit={() => {}}
      onBackgroundClick={() => {}}
    />,
  );
  return { container, onStartDrag };
}

describe("photo crop on the page", () => {
  it("draws the photo at its crop, as the press PDF prints it", () => {
    const { container } = render(<StaticPage page={pageWith(photo)} scale={1} />);
    const img = container.querySelector<HTMLImageElement>("img[data-photo]")!;
    expect(img.style.objectPosition).toBe("20% 80%");
    expect(img.style.width).toBe("200%");
    expect(img.style.left).toBe("-20%");
    expect(img.style.top).toBe("-80%");
  });

  it("never crops a contained cutout", () => {
    const cutout = { ...photo, fit: "contain" as const };
    const { container } = render(<StaticPage page={pageWith(cutout)} scale={1} />);
    const img = container.querySelector<HTMLImageElement>("img[data-photo]")!;
    expect(img.className).toContain("object-contain");
    expect(img.style.objectPosition).toBe("");
  });

  it("moves the frame, with its handles, when not adjusting", () => {
    const { container, onStartDrag } = renderCanvas(null);
    expect(screen.getByLabelText("Rotate")).toBeTruthy();
    fireEvent.pointerDown(container.querySelector("[data-photo-window]")!);
    expect(onStartDrag).toHaveBeenCalledWith(expect.anything(), photo, "move");
  });

  it("pans the photo instead, without handles, while adjusting", () => {
    const { container, onStartDrag } = renderCanvas("photo");
    expect(screen.queryByLabelText("Rotate")).toBeNull();
    expect(screen.queryByLabelText("Resize from top left")).toBeNull();
    fireEvent.pointerDown(container.querySelector("[data-photo-window]")!);
    expect(onStartDrag).toHaveBeenCalledWith(expect.anything(), photo, "pan");
  });
});

describe("fills and notched corners", () => {
  const page = (elements: DesignPage["elements"]): DesignPage => ({ id: "p1", elements });

  it("fills a rectangle when it has a fill, and leaves it hollow when not", () => {
    const { container } = render(
      <StaticPage
        page={page([
          { id: "a", type: "shape", shape: "rect", color: "#b3e0f6", fill: "#b3e0f6", strokeWidth: 1, x: 5, y: 5, w: 90, h: 90 },
          { id: "b", type: "shape", shape: "rect", color: "#000000", strokeWidth: 1, x: 5, y: 5, w: 20, h: 20 },
        ])}
        scale={1}
      />,
    );
    const [filled, hollow] = Array.from(
      container.querySelectorAll<HTMLDivElement>('div[style*="solid"]'),
    );
    expect(filled.style.backgroundColor).toBe("rgb(179, 224, 246)");
    expect(hollow.style.backgroundColor).toBe("");
  });

  it("draws a notched frame as one notched line per ring", () => {
    const { container } = render(
      <StaticPage
        page={page([
          { id: "f", type: "frame", variant: "double", corners: "notched", color: "#555555", x: 5, y: 5, w: 90, h: 90 },
        ])}
        scale={1}
      />,
    );
    const paths = container.querySelectorAll("svg path");
    expect(paths).toHaveLength(2);
    expect(paths[0].getAttribute("d")).toContain(" A ");
    expect(paths[0].getAttribute("stroke-width")).toBe("1");
    expect(paths[1].getAttribute("stroke-width")).toBe("2.5");
  });

  it("borders a notched photo with a notched line, not a square one", () => {
    const { container } = render(
      <StaticPage page={pageWith({ ...photo, shape: "notched", border: "single", borderColor: "#555555" })} scale={1} />,
    );
    expect(container.querySelector("svg path")?.getAttribute("d")).toContain(" A ");
  });
});
