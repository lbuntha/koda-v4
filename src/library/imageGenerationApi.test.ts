import { describe, expect, it, vi } from "vitest";
import { cropRect, generateBookImage } from "./imageGenerationApi";

vi.mock("../lib/tutorApi", () => ({ tutorHeaders: async () => ({ Authorization: "Bearer t" }) }));

/**
 * Cropping an AI picture to a page's exact shape.
 *
 * Neither image API hands back precisely a 2:1 banner or a 3:4 portrait, so
 * this arithmetic is what actually keeps the reader's promise that a picture's
 * shape is known before it arrives — everything downstream trusts this.
 */
describe("the rectangle cropped from a generated picture", () => {
  it("trims height when the source is relatively taller than the target", () => {
    // Imagen's 16:9 (1408×768, ratio 1.78) asked to become a 2:1 banner: not as
    // wide for its height as a banner wants, so the height comes down instead.
    expect(cropRect(1408, 768, 2)).toEqual({ sx: 0, sy: 32, width: 1408, height: 704 });
  });

  it("trims width when the source is relatively wider than the target", () => {
    // A 2.22:1 source, wider for its height than a 2:1 banner wants — this
    // time it is the width that comes down.
    expect(cropRect(2000, 900, 2)).toEqual({ sx: 100, sy: 0, width: 1800, height: 900 });
  });

  it("trims height for a portrait too, the same way", () => {
    // ChatGPT's 1024×1536 (ratio 0.667) asked to become a 3:4 portrait (0.75):
    // taller for its width than a portrait wants, so the height comes down.
    expect(cropRect(1024, 1536, 0.75)).toEqual({ sx: 0, sy: 86, width: 1024, height: 1365 });
  });

  it("crops nothing when the source is already the target ratio", () => {
    expect(cropRect(1200, 1600, 0.75)).toEqual({ sx: 0, sy: 0, width: 1200, height: 1600 });
  });

  it("never asks for more than the source has", () => {
    for (const [w, h, target] of [[1408, 768, 2], [1024, 1536, 0.75], [900, 900, 2], [900, 900, 0.75]] as const) {
      const r = cropRect(w, h, target);
      expect(r.width).toBeLessThanOrEqual(w);
      expect(r.height).toBeLessThanOrEqual(h);
      expect(r.sx + r.width).toBeLessThanOrEqual(w);
      expect(r.sy + r.height).toBeLessThanOrEqual(h);
    }
  });

  it("lands on exactly the target ratio, not just close to it", () => {
    for (const [w, h, target] of [[1408, 768, 2], [1024, 1536, 0.75], [1536, 1024, 2]] as const) {
      const r = cropRect(w, h, target);
      expect(r.width / r.height).toBeCloseTo(target, 2);
    }
  });

  it("crops centred, with equal room left on both sides", () => {
    const r = cropRect(1408, 768, 2);
    expect(r.sx).toBe(1408 - r.width - r.sx);
  });
});

describe("asking for a book picture", () => {
  it("posts the prompt and shape to this app's own server, by provider", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetchMock);
    await generateBookImage("a market stall", "portrait", "openai");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/library/image/openai");
    expect(JSON.parse(String(init.body))).toEqual({ prompt: "a market stall", kind: "portrait" });
    vi.unstubAllGlobals();
  });

  it("carries the server's own reason when it cannot help", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "The picture was not made: safety" } }), { status: 502 })));
    await expect(generateBookImage("x", "banner", "gemini")).rejects.toThrow("safety");
    vi.unstubAllGlobals();
  });
});
