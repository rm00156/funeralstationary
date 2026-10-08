import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminVerifyForm from "@/components/AdminVerifyForm";

afterEach(cleanup);

describe("AdminVerifyForm", () => {
  it("posts the token once as soon as it mounts, even under strict mode", () => {
    const tokens: Array<FormDataEntryValue | null> = [];
    const submit = vi
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(function (this: HTMLFormElement) {
        tokens.push(new FormData(this).get("token"));
      });
    try {
      render(
        <StrictMode>
          <AdminVerifyForm token="abc123" />
        </StrictMode>,
      );
    } finally {
      submit.mockRestore();
    }
    expect(tokens).toEqual(["abc123"]);
  });

  it("doesn't let the button post the token again while the first post is on its way", () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    const posted = vi.fn();
    document.addEventListener("submit", posted);
    try {
      render(<AdminVerifyForm token="abc123" />);
      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    } finally {
      document.removeEventListener("submit", posted);
      submit.mockRestore();
    }
    expect(posted).toHaveBeenCalledTimes(1);
    expect(posted.mock.calls[0][0].defaultPrevented).toBe(true);
  });

  it("keeps a button to post it by hand when the script can't", () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    try {
      render(<AdminVerifyForm token="abc123" />);
    } finally {
      submit.mockRestore();
    }
    const form = screen.getByRole("button", { name: /sign in/i }).closest("form");
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.getAttribute("action")).toBe("/api/admin/verify");
  });
});
