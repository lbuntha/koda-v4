import { describe, expect, it } from "vitest";
import { installKind, shareSpot } from ".";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const MESSENGER = ANDROID + " [FB_IAB/Orca-Android;FBAV/460.0.0.0;]";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

describe("installKind", () => {
  it("explains Share → Add to Home Screen on an iPhone", () => {
    expect(installKind(IPHONE)).toBe("ios");
  });
  it("sends Facebook and Messenger's browser to a real browser first", () => {
    expect(installKind(MESSENGER)).toBe("in-app");
  });
  it("points an Android browser with no prompt at its menu", () => {
    expect(installKind(ANDROID)).toBe("manual");
  });
  it("offers nothing on a computer that cannot install", () => {
    expect(installKind(DESKTOP)).toBe("unsupported");
  });
  it("uses the browser's own install box once it offers one", () => {
    const event = Object.assign(new Event("beforeinstallprompt"), {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: "dismissed" as const }),
    });
    window.dispatchEvent(event);
    expect(installKind(ANDROID)).toBe("prompt");
    expect(installKind(DESKTOP)).toBe("prompt");
  });
});

describe("shareSpot", () => {
  const safari = (version: string) =>
    `Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Mobile/15E148 Safari/604.1`;
  it("points at the bottom bar in Safari up to 18", () => {
    expect(shareSpot(safari("17.5"))).toBe("bottom");
  });
  it("points at ••• in Safari 26", () => {
    expect(shareSpot(safari("26.0"))).toBe("more");
  });
  it("points at the top right in Chrome on iPhone", () => {
    expect(shareSpot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1")).toBe("top");
  });
  it("points at the top right on an iPad", () => {
    expect(shareSpot("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")).toBe("top");
  });
  it("points at the menu in Firefox and Edge", () => {
    expect(shareSpot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/140.0 Mobile/15E148 Safari/605.1.15")).toBe("menu");
  });
});
