import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

/**
 * A shelf mounts every cover at once. A photo cover must wait until it comes
 * near the screen before downloading, or a big library downloads every cover
 * before the child has scrolled.
 */

const photoUrl = vi.fn(async () => "blob:cover");
vi.mock("./photos", () => ({
  isPhoto: (k: string) => k.startsWith("photo-"),
  knownPhotoUrl: () => null,
  photoUrl: (...a: unknown[]) => photoUrl(...(a as [])),
}));

import { Picture } from "./Picture";

let seen: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
class FakeObserver {
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    seen = cb;
  }
  observe() {}
  disconnect() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  photoUrl.mockClear();
  seen = null;
});

describe("a photo cover", () => {
  it("downloads only once it comes near the screen", async () => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(<Picture name="photo-abc" />);
    expect(photoUrl).not.toHaveBeenCalled();

    await act(async () => seen?.([{ isIntersecting: true }]));
    expect(photoUrl).toHaveBeenCalledWith("photo-abc");
  });

  it("downloads straight away where the browser cannot tell what is on screen", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Picture name="photo-abc" />);
    await act(async () => {});
    expect(photoUrl).toHaveBeenCalledWith("photo-abc");
  });
});
