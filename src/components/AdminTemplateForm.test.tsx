import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminTemplateForm from "@/components/AdminTemplateForm";
import type { AdminTemplate } from "@/lib/adminCatalogue.server";
import { BOOKLET_FORMAT } from "@/lib/designEditor";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
});

const TEMPLATE: AdminTemplate = {
  slug: "jamaican-peace",
  name: "Jamaican Peace",
  productSlug: "order-of-service",
  productFormat: BOOKLET_FORMAT,
  previewImageUrl: "https://bucket.example/template-previews/jamaican-peace-1.png",
  placeholderPortrait: null,
  status: "published",
  sortOrder: 1,
  categories: [],
  hasDraftLayout: false,
  updatedAt: new Date("2026-10-08T12:00:00Z"),
};

function renderForm() {
  const fetchMock = vi.fn(async () => Response.json({ template: TEMPLATE }));
  vi.stubGlobal("fetch", fetchMock);
  render(
    <AdminTemplateForm
      template={TEMPLATE}
      products={[]}
      categories={[]}
      portraitUrls={{}}
    />,
  );
  const sentBody = async () => {
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return JSON.parse(String(init.body)) as Record<string, unknown>;
  };
  return { sentBody };
}

describe("AdminTemplateForm", () => {
  it("doesn't resend the preview URL it loaded with, so a server-side redraw isn't put back", async () => {
    const { sentBody } = renderForm();
    fireEvent.click(screen.getByRole("radio", { name: "portrait 7" }));
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));

    const body = await sentBody();
    expect(body).not.toHaveProperty("previewImageUrl");
    expect(body.placeholderPortrait).toBe("portrait-7");
  });

  it("sends a preview URL the admin pasted", async () => {
    const { sentBody } = renderForm();
    fireEvent.change(screen.getByLabelText(/paste an image url/i), {
      target: { value: "https://bucket.example/mine.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));

    expect((await sentBody()).previewImageUrl).toBe("https://bucket.example/mine.png");
  });
});
