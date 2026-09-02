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
