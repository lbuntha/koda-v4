import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProgressShortcuts } from "./ProgressShortcuts";
import { PROFILE_SECTIONS, takePendingProfileSection } from "./account/profileSections";

/**
 * The tiles that replaced Home's rail on a phone.
 *
 * A deep link is two halves that fail *silently* when they disagree: a tile
 * pointing at a section that was renamed scrolls nowhere and throws nothing. So
 * the assertions here are mostly about the two halves still agreeing.
 */

vi.mock("../utils/audio", () => ({ playSound: vi.fn() }));

beforeEach(() => {
  // Clear anything a previous test left waiting.
  takePendingProfileSection();
});
afterEach(cleanup);

const draw = () => {
  const onSelectTab = vi.fn();
  render(<ProgressShortcuts onSelectTab={onSelectTab} />);
  return onSelectTab;
};

describe("the progress tiles", () => {
  it("offers the two remaining sections a learner came looking for", () => {
    draw();

    for (const label of ["Today", "Badges"]) {
      expect(screen.getByRole("button", { name: label }), `${label} is missing`).toBeTruthy();
    }
  });

  it("asks for the section before it changes tab", () => {
    // Order matters: `ProfilePage` reads the request as it mounts, so a request
    // made after the tab switch would arrive too late to be seen.
    const onSelectTab = draw();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));

    expect(onSelectTab).toHaveBeenCalledWith("profile");
    expect(takePendingProfileSection()).toBe(PROFILE_SECTIONS.today);
  });

  it("sends each tile to its own section", () => {
    draw();

    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(takePendingProfileSection()).toBe(PROFILE_SECTIONS.today);

    fireEvent.click(screen.getByRole("button", { name: "Badges" }));
    expect(takePendingProfileSection()).toBe(PROFILE_SECTIONS.achievements);
  });

  it("is hidden where the rail already carries these", () => {
    // Above `rail:` the sidebar and Home's own rail are on screen, and this
    // would be the same door a second time.
    const { container } = render(<ProgressShortcuts onSelectTab={vi.fn()} />);

    expect(container.querySelector("section")?.className).toContain("rail:hidden");
  });
});

describe("the request Profile picks up", () => {
  it("fires once, so returning by the tab bar does not scroll again", () => {
    const onSelectTab = draw();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(onSelectTab).toHaveBeenCalled();

    expect(takePendingProfileSection()).toBe(PROFILE_SECTIONS.today);
    expect(takePendingProfileSection()).toBeNull();
  });

});
