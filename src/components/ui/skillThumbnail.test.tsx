import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { UISkillThumbnail } from "./UISkillThumbnail";
import { replaceSharedArt } from "../../lib/sharedArtStore";

/**
 * A thumbnail names artwork the build has never seen.
 *
 * The bundle is only one of three art libraries, and the two that matter to an
 * operator — their own and the shared collection — arrive at runtime. Asking
 * the bundle alone whether an id is artwork answered "no" for every picture
 * filed on the Art page, and the tile then printed the id as letters in a
 * coloured square. That is the regression these cover.
 */
const SHARED_ART = {
  id: "counting-quests",
  category: "thumbnail",
  markup: '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#5b21b6" /></svg>',
};

describe("UISkillThumbnail resolving a thumbnail string", () => {
  it("draws artwork that exists only in the shared library", async () => {
    await replaceSharedArt([SHARED_ART]);

    const { container } = render(<UISkillThumbnail thumbnail="counting-quests" />);

    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText("counting-quests")).toBeNull();
  });

  it("never prints an unresolvable name as its own letters", async () => {
    await replaceSharedArt([SHARED_ART]);

    render(<UISkillThumbnail thumbnail="counting-quest" fallbackIconName="hash" />);

    // The shipped icon stands in; the name itself is not the tile.
    expect(screen.queryByText("counting-quest")).toBeNull();
  });

  it("still draws an emoji as typed", async () => {
    await replaceSharedArt([SHARED_ART]);

    render(<UISkillThumbnail thumbnail="🍎" />);

    expect(screen.getByText("🍎")).not.toBeNull();
  });
});

/**
 * A card window is not the art's shape.
 *
 * Art drawn to some other ratio than the 16:9 a listing expects still has to
 * fill the window, so the fit rule has to say "crop" — and it lives in the
 * markup, not in a class, which is exactly the kind of thing that silently
 * stops being applied.
 */
describe("cropping artwork to a frame", () => {
  it("rewrites the fit rule to cover when asked", async () => {
    await replaceSharedArt([SHARED_ART]);

    const { container } = render(
      <UISkillThumbnail thumbnail="counting-quests" fill cover />,
    );

    expect(container.querySelector("svg")?.getAttribute("preserveAspectRatio")).toBe(
      "xMidYMid slice",
    );
  });

  it("leaves the artwork fitting inside the box by default", async () => {
    await replaceSharedArt([SHARED_ART]);

    const { container } = render(<UISkillThumbnail thumbnail="counting-quests" />);

    expect(container.querySelector("svg")?.getAttribute("preserveAspectRatio")).toBeNull();
  });
});
