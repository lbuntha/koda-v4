import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Picture } from "./Picture";

vi.mock("../assets/svg", () => ({ SvgAsset: ({ fallback }: { fallback?: React.ReactNode }) => <>{fallback}</>, SvgMarkup: () => null }));
vi.mock("./photos", async (orig) => ({ ...(await orig<typeof import("./photos")>()), photoUrl: vi.fn(async () => "blob:pigs"), knownPhotoUrl: () => "blob:pigs" }));

const PHOTO = "photo-" + "d".repeat(64);

/**
 * A cover is the whole picture; a page's picture is cropped to fill its frame.
 * Which one a photo gets is the only difference, and getting it wrong shows as
 * three little pigs with their bodies cut off.
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
});
