import { cleanup, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminVerifyForm from "@/components/AdminVerifyForm";

afterEach(cleanup);

describe("AdminVerifyForm", () => {
  it("posts the token once as soon as it mounts, even under strict mode", () => {
    const submits: FormData[] = [];
    const onSubmit = vi.fn((event: SubmitEvent) => {
      event.preventDefault();
      submits.push(new FormData(event.target as HTMLFormElement));
    });
    document.addEventListener("submit", onSubmit);
    try {
      render(
        <StrictMode>
          <AdminVerifyForm token="abc123" />
        </StrictMode>,
      );
    } finally {
      document.removeEventListener("submit", onSubmit);
    }
    expect(submits).toHaveLength(1);
    expect(submits[0].get("token")).toBe("abc123");
  });

  it("keeps a button to post it by hand when the script can't", () => {
    document.addEventListener("submit", (e) => e.preventDefault(), { once: true });
    render(<AdminVerifyForm token="abc123" />);
    const button = screen.getByRole("button", { name: /sign in/i });
    const form = button.closest("form");
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.getAttribute("action")).toBe("/api/admin/verify");
  });
});
