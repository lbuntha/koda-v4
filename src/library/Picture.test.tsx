import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Picture } from "./Picture";

vi.mock("../assets/svg", () => ({ SvgAsset: ({ fallback }: { fallback?: React.ReactNode }) => <>{fallback}</>, SvgMarkup: () => null }));
vi.mock("./photos", async (orig) => ({ ...(await orig<typeof import("./photos")>()), photoUrl: vi.fn(async () => "blob:pigs"), knownPhotoUrl: () => "blob:pigs" }));

const PHOTO = "photo-" + "d".repeat(64);

/**
 * A photo in its frame.
 *
 * `whole` is which of a photo's frame the tests in this file mostly cover;
 * `fill` is a positioning choice that only the cover uses, and it has a rule a
 * test can hold it to even without a real layout engine: `position: relative`
 * and `position: absolute` must never both land on the same element. jsdom
 * does not do layout, so it cannot see a picture collapse to nothing — but a
 * real browser measurement did, once, on the cover this exact combination
 * broke. That measurement cannot run in this suite, so the class list is what
 * stands guard here.
 */
describe("a photo in its frame", () => {
  it("is cropped to fill the frame by default", async () => {
    const { container } = render(<Picture name={PHOTO} />);
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    expect(container.querySelector("img")!.className).toContain("object-cover");
  });

  it("is shown whole on a cover", async () => {
    const { container } = render(<Picture name={PHOTO} whole />);
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    const img = container.querySelector("img")!;
    expect(img.className).toContain("object-contain");
    expect(img.className).not.toContain("object-cover");
  });

  it("never mixes relative and absolute on the same frame — a photo, a drawing, or either mode", async () => {
    const cases = [
      <Picture key="photo-flow" name={PHOTO} />,
      <Picture key="photo-fill" name={PHOTO} fill />,
      <Picture key="drawing-flow" name="cat" />,
      <Picture key="drawing-fill" name="cat" fill />,
    ];
    for (const el of cases) {
      const { container, unmount } = render(el);
      const outer = container.firstElementChild!;
      const classes = outer.className.split(/\s+/);
      const hasBoth = classes.includes("relative") && classes.includes("absolute");
      expect(hasBoth, `${outer.className} has both relative and absolute`).toBe(false);
      unmount();
    }
  });

  it("positions the frame absolutely, with no fight for it to lose, when asked to fill", async () => {
    const { container } = render(<Picture name={PHOTO} fill />);
    const outer = container.firstElementChild!;
    expect(outer.className).toContain("absolute");
    expect(outer.className).not.toContain("relative");
    expect(outer.className).toContain("inset-0");
  });
});
