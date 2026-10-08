import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { useConfirmDialog, type ConfirmOptions, type PromptOptions } from "@/components/ConfirmDialog";

beforeAll(() => {
  // jsdom has <dialog> but not always its modal API.
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
  }
});

/** Renders the hook and hands its confirm/prompt out to the test. */
function setup() {
  const api: {
    confirm?: (options: ConfirmOptions) => Promise<boolean>;
    prompt?: (options: PromptOptions) => Promise<string | null>;
  } = {};
  function Harness() {
    const { confirm, prompt, dialog } = useConfirmDialog();
    api.confirm = confirm;
    api.prompt = prompt;
    return <>{dialog}</>;
  }
  render(<Harness />);
  return api as Required<typeof api>;
}

describe("useConfirmDialog", () => {
  it("resolves a confirm true on the confirm button and false on cancel", async () => {
    const { confirm } = setup();

    let answer!: Promise<boolean>;
    act(() => {
      answer = confirm({ title: "Remove it?", confirmLabel: "Remove", cancelLabel: "Keep it" });
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await expect(answer).resolves.toBe(true);

    act(() => {
      answer = confirm({ title: "Remove it?", confirmLabel: "Remove", cancelLabel: "Keep it" });
    });
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    await expect(answer).resolves.toBe(false);
  });

  it("answers a question replaced by a second one as cancelled, rather than leaving it waiting", async () => {
    const { confirm } = setup();

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = confirm({ title: "Apply Lily?", confirmLabel: "Apply" });
    });
    act(() => {
      second = confirm({ title: "Apply Rose?", confirmLabel: "Apply" });
    });
    await expect(first).resolves.toBe(false);

    expect(screen.getByRole("heading", { name: "Apply Rose?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await expect(second).resolves.toBe(true);
  });

  it("starts each prompt from its own default, not the text left in the one it replaced", async () => {
    const { prompt } = setup();

    let first!: Promise<string | null>;
    let second!: Promise<string | null>;
    act(() => {
      first = prompt({ title: "Rename", label: "Design name", defaultValue: "Mum" });
    });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "half-typed" } });
    act(() => {
      second = prompt({ title: "Rename", label: "Design name", defaultValue: "Dad" });
    });
    await expect(first).resolves.toBeNull();

    expect(screen.getByRole("textbox")).toHaveValue("Dad");
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await expect(second).resolves.toBe("Dad");
  });
});
