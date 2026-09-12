import { describe, expect, it } from "vitest";
import { safeParse, safePath } from "./pushPayload";

/**
 * These run on bytes from the network. The interesting cases are all the ones
 * where the message is wrong, because a service worker has nobody to report to.
 */

describe("where a tap is allowed to land", () => {
  it("keeps a path on this origin, query and fragment included", () => {
    expect(safePath("/family/mia?tab=week#today")).toBe("/family/mia?tab=week#today");
  });

  it.each<[unknown, string]>([
    ["https://evil.example/steal", "an absolute URL"],
    ["//evil.example", "a protocol-relative host"],
    ["/\\evil.example", "a backslash a browser will normalise into a slash"],
    ["javascript:alert(1)", "a scheme that is not navigation at all"],
    ["family/mia", "a relative path, which resolves against whatever page is open"],
    [42, "not a string"],
    [undefined, "nothing"],
  ])("refuses %s (%s) and lands on the home screen", (input: unknown) => {
    expect(safePath(input)).toBe("/");
  });
});

describe("reading the message", () => {
  it("takes a well-formed payload as written", () => {
    const payload = safeParse(
      JSON.stringify({ title: "Mia met her goal", body: "Six rounds today.", path: "/family/mia", kind: "learn.goal_met" }),
    );

    expect(payload).toMatchObject({ title: "Mia met her goal", body: "Six rounds today.", path: "/family/mia" });
  });

  it("still says something when there is no payload at all", () => {
    // The case that matters: showing nothing is what makes Chrome write its own
    // notice, in words nobody here chose.
    expect(safeParse(null).title).toBe("Koda");
    expect(safeParse("").body).toBeTruthy();
  });

  it("treats text that is not JSON as the body", () => {
    expect(safeParse("hello from a test").body).toBe("hello from a test");
  });

  it("falls back field by field rather than rejecting the whole message", () => {
    const payload = safeParse(JSON.stringify({ title: "Half a message" }));

    expect(payload.title).toBe("Half a message");
    expect(payload.body).toBeTruthy();
    expect(payload.path).toBe("/");
  });

  it("does not let a notification carry a wall of text", () => {
    const payload = safeParse(JSON.stringify({ body: "x".repeat(5000) }));

    expect(payload.body.length).toBeLessThanOrEqual(300);
  });

  it("sanitises the path inside a payload, not only on its own", () => {
    expect(safeParse(JSON.stringify({ path: "https://evil.example" })).path).toBe("/");
  });
});

/**
 * What FCM actually posts to the browser.
 *
 * The server sends `data` only and no `notification` block, so that the copy,
 * the icon and the tap target stay ours. FCM then wraps those fields again, and
 * a raw `push` listener — which is what Koda has, on purpose, rather than a
 * second worker — receives the wrapper. Reading the outer object put "Open Koda
 * to see what's new" on every lock screen while the server had composed the
 * real sentence and recorded it correctly in the history.
 */
describe("the envelope FCM puts the message in", () => {
  const fromFcm = JSON.stringify({
    data: {
      title: "New sign-in to Koda",
      body: "Chrome on Mac just signed in. If that wasn't you, sign it out in Settings.",
      path: "/settings",
      kind: "device.new_signin",
      tag: "device.new_signin",
    },
    from: "1234567890",
    priority: "normal",
    fcmMessageId: "abc-123",
  });

  it("reads the message inside it", () => {
    const payload = safeParse(fromFcm);

    expect(payload.title).toBe("New sign-in to Koda");
    expect(payload.body).toBe(
      "Chrome on Mac just signed in. If that wasn't you, sign it out in Settings.",
    );
    expect(payload.kind).toBe("device.new_signin");
    expect(payload.tag).toBe("device.new_signin");
  });

  it("sanitises a path that arrives wrapped, exactly as it does one that does not", () => {
    const payload = safeParse(JSON.stringify({ data: { title: "Hi", path: "//evil.example" } }));

    expect(payload.path).toBe("/");
  });

  it("leaves a flat payload alone", () => {
    // The console driver logs this shape, and so does a hand-sent test.
    const payload = safeParse(JSON.stringify({ title: "Koda", body: "Flat and fine", path: "/" }));

    expect(payload.body).toBe("Flat and fine");
  });

  it("is not fooled by a `data` that is not an object", () => {
    const payload = safeParse(JSON.stringify({ data: "nonsense", title: "Koda", body: "Still me" }));

    expect(payload.body).toBe("Still me");
  });
});
