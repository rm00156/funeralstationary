import { afterEach, describe, expect, it, vi } from "vitest";

import { focusFirstError } from "@/lib/focusFirstError";

afterEach(() => {
  document.body.innerHTML = "";
});

function form(html: string): HTMLFormElement {
  document.body.innerHTML = `<form>${html}</form>`;
  const element = document.querySelector("form")!;
  // jsdom doesn't lay pages out, so scrollIntoView doesn't exist there.
  for (const node of element.querySelectorAll<HTMLElement>("*")) node.scrollIntoView = vi.fn();
  return element;
}

describe("focusFirstError", () => {
  it("goes to the first invalid field in page order, and focuses it", () => {
    const element = form(`
      <div role="alert">Please check the highlighted fields.</div>
      <input id="a" />
      <input id="b" aria-invalid="true" />
      <input id="c" aria-invalid="true" />`);
    const target = focusFirstError(element);
    expect(target?.id).toBe("b");
    expect(document.activeElement?.id).toBe("b");
    expect(target?.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "center" }));
  });

  it("shows the message when no field is at fault, without moving focus", () => {
    const element = form(`<div role="alert" id="msg">Our form isn't available right now.</div><input id="a" />`);
    const target = focusFirstError(element);
    expect(target?.id).toBe("msg");
    expect(target?.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it("does nothing when there is nothing to show", () => {
    expect(focusFirstError(form(`<input />`))).toBeNull();
    expect(focusFirstError(null)).toBeNull();
  });
});
