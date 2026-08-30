import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Where the live-voice socket is dialled.
 *
 * Same origin as the page — except behind Firebase Hosting, which proxies every
 * path to Cloud Run but does not perform the WebSocket upgrade. A handshake
 * through the Hosting domain comes back `200` instead of `101`, so the socket
 * never opens and `wss.on("connection")` never fires. Nothing logs an error:
 * the request looks served, and the coach simply sits there.
 *
 * The failure is invisible from the client, so the deployment has to say where
 * the socket may be opened. These pin the three things that rule has to get
 * right: convert the scheme, treat silence as same-origin, and never throw.
 */

const load = async () => (await import("./geminiLiveAudio")).liveSocketOrigin;

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

const serverSays = (body: unknown) =>
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => body }));

describe("the live socket's origin", () => {
  it("is the page's own when the deployment names none", async () => {
    serverSays({ liveWsOrigin: "" });

    expect(await (await load())()).toBe("");
  });

  it("becomes wss when the deployment names an https origin", async () => {
    // What the deploy writes: a Cloud Run URL, which is https.
    serverSays({ liveWsOrigin: "https://koda-app-abc123-uc.a.run.app" });

    expect(await (await load())()).toBe("wss://koda-app-abc123-uc.a.run.app");
  });

  it("becomes ws for a plain-http origin, so a dev box can point elsewhere", async () => {
    serverSays({ liveWsOrigin: "http://localhost:4000" });

    expect(await (await load())()).toBe("ws://localhost:4000");
  });

  it("falls back to same-origin rather than throwing when config cannot be read", async () => {
    // A coach that cannot reach its config should still try the obvious
    // address. Refusing to start would be a worse failure than a wrong guess.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    expect(await (await load())()).toBe("");
  });

  it("ignores a malformed answer instead of building a nonsense URL", async () => {
    serverSays({ liveWsOrigin: 42 });

    expect(await (await load())()).toBe("");
  });

  it("asks once and remembers, so every reconnection is not a round trip", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ liveWsOrigin: "https://example.run.app" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const origin = await load();
    await origin();
    await origin();
    await origin();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * The session token must never reach the URL.
 *
 * It used to: a WebSocket handshake cannot carry an Authorization header, so
 * the token travelled as a query parameter. Every proxy, CDN and load balancer
 * on the path writes URLs to a log, and full admin and child JWTs were sitting
 * in plaintext in Cloud Run's request log — readable by anyone with log access,
 * for as long as logs are retained. "It expires in fifteen minutes" is not the
 * same as harmless.
 *
 * This is a source-level test on purpose. The leak is not a behaviour anybody
 * observes at runtime — the socket works perfectly either way — so the only
 * thing that can catch its return is the shape of the URL being built.
 */
describe("the live socket URL", () => {
  it("never carries the session token", async () => {
    const source = await import("./geminiLiveAudio?raw").then((m) => m.default as string);
    const urlLine = source
      .split("\n")
      .find((line) => line.includes("/api/live?voice="));

    expect(urlLine, "the live socket URL is built somewhere else now").toBeTruthy();
    expect(urlLine).not.toMatch(/token=/);
  });

  it("sends the token as the socket's first frame instead", async () => {
    const source = await import("./geminiLiveAudio?raw").then((m) => m.default as string);

    expect(source).toContain('JSON.stringify({ type: "auth", token })');
  });
});
