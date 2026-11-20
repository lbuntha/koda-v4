import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChildSettingsFields } from "./ChildSettingsFields";
import { CHILD_SETTINGS_DEFAULTS } from "../../lib/childSettings";

vi.mock("../../utils/audio", () => ({ playSound: () => {} }));

describe("the Review mistakes switch", () => {
  it("is on by default and turns off with one tap", () => {
    const onChange = vi.fn();
    render(<ChildSettingsFields value={CHILD_SETTINGS_DEFAULTS} onChange={onChange} childName="Dara" />);
    const toggle = screen.getByRole("switch", { name: "Review mistakes" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith({ reviewEnabled: false });
  });

  it("turns back on", () => {
    const onChange = vi.fn();
    render(<ChildSettingsFields value={{ ...CHILD_SETTINGS_DEFAULTS, reviewEnabled: false }} onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: "Review mistakes" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith({ reviewEnabled: true });
  });
});
