import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChildSettingsFields } from "./ChildSettingsFields";
import { CHILD_SETTINGS_DEFAULTS } from "../../lib/childSettings";

vi.mock("../../utils/audio", () => ({ playSound: () => {} }));

describe("the Play with others switch", () => {
  it("is on by default and a grown-up turns it off with one tap", () => {
    const onChange = vi.fn();
    render(<ChildSettingsFields value={CHILD_SETTINGS_DEFAULTS} onChange={onChange} childName="Dara" />);
    const toggle = screen.getByRole("switch", { name: "Play with others" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith({ groupPlayEnabled: false });
  });

  it("says what friends can see", () => {
    render(<ChildSettingsFields value={CHILD_SETTINGS_DEFAULTS} onChange={() => {}} />);
    expect(screen.getByText(/only see a nickname and a picture, and there is no chat/)).toBeTruthy();
  });
});
