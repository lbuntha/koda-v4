import { describe, expect, it } from "vitest";

import { describeThisDevice } from "./thisDevice";

/**
 * The words in "Chrome on Mac just signed in".
 *
 * Two modules had each written their own answer to this, and a sign-in notice
 * was filled from the weaker one: "Mac just signed in" tells a parent who owns
 * a Mac nothing they can act on, and the whole point of an account notification
 * is that it can be checked.
 *
 * The user agents below are real ones, trimmed of their version noise. Most of
 * these assertions are about *order*: Edge and Opera both say "Chrome" in their
 * user agent and Chrome says "Safari", so a naive chain names every browser
 * Chrome and Chrome Safari.
 */

const UA = {
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  chromeIpad:
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
  samsung:
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
};

describe("naming the device a notice is about", () => {
  it("names the browser and the platform", () => {
    expect(describeThisDevice(UA.chromeMac)).toBe("Chrome on Mac");
    expect(describeThisDevice(UA.safariMac)).toBe("Safari on Mac");
    expect(describeThisDevice(UA.chromeAndroid)).toBe("Chrome on Android");
    expect(describeThisDevice(UA.safariIphone)).toBe("Safari on iPhone");
    expect(describeThisDevice(UA.firefoxLinux)).toBe("Firefox on Linux");
  });

  it("does not call Edge Chrome, or Chrome Safari", () => {
    expect(describeThisDevice(UA.edgeWindows)).toBe("Edge on Windows");
    expect(describeThisDevice(UA.chromeMac)).not.toContain("Safari");
  });

  it("knows Chrome on iOS by the name it actually goes under", () => {
    // `CriOS`, because every browser on iOS is WebKit underneath and says so.
    expect(describeThisDevice(UA.chromeIpad)).toBe("Chrome on iPad");
  });

  it("names a browser that says Chrome but is not", () => {
    expect(describeThisDevice(UA.samsung)).toBe("Samsung Internet on Android");
  });

  it("says whatever it still can rather than falling back to a placeholder", () => {
    // Half an answer is worth more than none on a security notice.
    expect(describeThisDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("Mac");
    expect(describeThisDevice("Firefox/131.0")).toBe("Firefox");
    expect(describeThisDevice("something nobody has ever shipped")).toBe("This device");
  });

  it("carries no version numbers", () => {
    // A notification is not a fingerprint, and "Chrome 141.0.7390.55 on macOS
    // 26.1" is more than anybody needs to answer "was that me?".
    for (const ua of Object.values(UA)) {
      expect(describeThisDevice(ua)).not.toMatch(/\d/);
    }
  });
});
