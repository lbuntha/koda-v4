import { beforeEach, describe, expect, it, vi } from "vitest";

const features = vi.fn<() => string[]>();
const consent = vi.fn<() => boolean>();
vi.mock("../../lib/billing", () => ({ AI_FEATURE: "ai.koda", Billing: { has: (f: string) => features().includes(f) } }));
vi.mock("../../lib/childSettings", () => ({ ChildSettingsAPI: { current: () => ({ photoPagesEnabled: consent() }) } }));

const { isPhotoPage, photoPageLock } = await import("./photoPages");

describe("pictures from a child's own photo", () => {
  beforeEach(() => {
    features.mockReturnValue([]);
    consent.mockReturnValue(false);
  });

  it("needs the family's AI plan first", () => {
    consent.mockReturnValue(true);
    expect(photoPageLock()).toBe("plan");
  });

  it("then needs a grown-up's yes", () => {
    features.mockReturnValue(["ai.koda"]);
    expect(photoPageLock()).toBe("consent");
  });

  it("opens with both", () => {
    features.mockReturnValue(["ai.koda"]);
    consent.mockReturnValue(true);
    expect(photoPageLock()).toBeNull();
  });

  it("knows its pages from lesson pictures by id", () => {
    expect(isPhotoPage("photo-abc123")).toBe(true);
    expect(isPhotoPage("carrot-1")).toBe(false);
  });
});
