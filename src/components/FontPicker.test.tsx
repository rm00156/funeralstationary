import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FontPicker, findByPrefix } from "@/components/FontPicker";
import { FONT_OPTIONS, type FontFamilyId } from "@/lib/designEditor";

afterEach(cleanup);

function setup(value: FontFamilyId = "prata") {
  const onChange = vi.fn();
  render(<FontPicker value={value} onChange={onChange} />);
  return { onChange, button: screen.getByRole("button", { name: /^Font:/ }) };
}

const indexOfId = (id: FontFamilyId) => FONT_OPTIONS.findIndex((font) => font.id === id);

describe("FontPicker", () => {
  it("shows the current font's name in that font", () => {
    const { button } = setup("prata");
    expect(button).toHaveAccessibleName("Font: Prata");
    expect(within(button).getByText("Prata").style.fontFamily).toBe("var(--font-prata), serif");
  });

  it("draws every option in its own face, under Serif / Sans serif / Script", () => {
    const { button } = setup();
    fireEvent.click(button);

    const list = screen.getByRole("listbox", { name: "Font" });
    expect(within(list).getAllByRole("option")).toHaveLength(FONT_OPTIONS.length);
    for (const name of ["Serif", "Sans serif", "Script"]) {
      expect(within(list).getByRole("group", { name })).toBeInTheDocument();
    }
    const kristi = within(list).getByRole("option", { name: "Kristi" });
    expect(within(kristi).getByText("Kristi").style.fontFamily).toBe("var(--font-kristi), cursive");
    expect(within(list).getByRole("option", { name: "Prata" })).toHaveAttribute("aria-selected", "true");
  });

  it("chooses a font on click and closes", () => {
    const { button, onChange } = setup();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("option", { name: "Allura" }));
    expect(onChange).toHaveBeenCalledWith("allura");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("moves with the arrows and chooses with Enter", () => {
    const { button, onChange } = setup("prata");
    fireEvent.click(button);
    const list = screen.getByRole("listbox");
    expect(list).toHaveFocus();
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowUp" });
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(FONT_OPTIONS[indexOfId("prata") + 1].id);
  });

  it("closes on Escape without changing the font", () => {
    const { button, onChange } = setup();
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it("closes on a click outside", () => {
    const { button } = setup();
    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("doesn't call onChange when the current font is chosen again", () => {
    const { button, onChange } = setup("prata");
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("jumps by typed name", () => {
    const { button, onChange } = setup("display");
    fireEvent.click(button);
    const list = screen.getByRole("listbox");
    for (const key of "mea") fireEvent.keyDown(list, { key });
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("meaCulpa");
  });
});

describe("findByPrefix", () => {
  it("finds the next font starting with the letters typed, wrapping round", () => {
    expect(FONT_OPTIONS[findByPrefix("mer", 0)].id).toBe("merriweather");
    expect(FONT_OPTIONS[findByPrefix("l", FONT_OPTIONS.length - 1)].label).toMatch(/^L/);
    expect(findByPrefix("zz", 0)).toBe(-1);
  });

  it("cycles through a letter's fonts when it is pressed again", () => {
    const first = findByPrefix("p", 0);
    const second = findByPrefix("pp", first);
    expect(FONT_OPTIONS[first].label).toMatch(/^P/);
    expect(FONT_OPTIONS[second].label).toMatch(/^P/);
    expect(second).not.toBe(first);
  });
});

describe("FONT_OPTIONS", () => {
  it("lists each group's fonts together, so arrow order is the order on screen", () => {
    const groups = FONT_OPTIONS.map((font) => font.group).filter(
      (group, index, all) => index === 0 || all[index - 1] !== group,
    );
    expect(groups).toEqual(["serif", "sans", "script"]);
  });
});
