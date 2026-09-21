import { describe, expect, it } from "vitest";

import { preprocessSvgMarkup, sanitizeSvgMarkup } from "../../../utils/svg";

const files = import.meta.glob("./*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const avatars = ["avatar-fox", "avatar-mango", "avatar-penguin", "avatar-comet", "avatar-otter"] as const;

describe("avatar art collection", () => {
  it("ships the five leaderboard avatar drawings", () => {
    expect(Object.keys(files)).toHaveLength(avatars.length);
  });

  it.each(avatars)("%s uses the shared canvas and survives sanitising", (id) => {
    const path = Object.keys(files).find((file) => file.endsWith(`/${id}.svg`));
    expect(path, `no drawing for ${id}`).toBeTruthy();
    const markup = preprocessSvgMarkup(files[path!]);
    expect(markup).toContain('viewBox="0 0 100 100"');
    expect(markup).toContain('data-avatar-background="true"');
    expect(sanitizeSvgMarkup(markup)).toContain("<svg");
  });
});
