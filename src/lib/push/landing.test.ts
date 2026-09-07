import { describe, expect, it } from "vitest";
import { landingFor } from "./landing";

/**
 * The path in a notification arrives from the network, so this is a boundary
 * rather than a lookup. The worker's `safePath` has already refused another
 * origin; what is tested here is the second half of the rule — that the set of
 * screens a payload can reach is a list we wrote, not a string it chooses.
 */
describe("where a tapped notification lands", () => {
  it("opens the child a summary is about", () => {
    expect(landingFor("/children/l_1234567890abcdef0123")).toEqual({
      tab: "children",
      learnerId: "l_1234567890abcdef0123",
    });
  });

  it("opens the plain screens", () => {
    expect(landingFor("/")).toEqual({ tab: "home" });
    expect(landingFor("/devices")).toEqual({ tab: "devices" });
    expect(landingFor("/settings")).toEqual({ tab: "settings" });
  });

  it("sends anything it does not recognise home", () => {
    // Not an error and not a blank screen: a tap it cannot read is a tap that
    // opens Koda, which is what it did before this map existed.
    for (const path of ["/admin", "/koda", "", "/../etc", "/users/l_1234567890abcdef0123"]) {
      expect(landingFor(path), path).toEqual({ tab: "home" });
    }
  });

  it("refuses a malformed learner id rather than opening a record with it", () => {
    // The id goes on to open a child's record. The page reads it through the
    // family's own scoped endpoint, so this is not the authorisation — it is
    // what stops a malformed one reaching it at all.
    expect(landingFor("/children/not-a-learner")).toEqual({ tab: "children" });
    expect(landingFor("/children/l_short")).toEqual({ tab: "children" });
    // Traversal reaches the list, never a record: the segment is not an id.
    expect(landingFor("/children/../users")).toEqual({ tab: "children" });
  });

  it("keeps a host out of the map even if one gets past the worker", () => {
    // Defence in depth: `safePath` should never let this through, and if it
    // did, "evil.example" must not become a tab.
    expect(landingFor("https://evil.example/children/l_1234567890abcdef0123")).toEqual({
      tab: "children",
      learnerId: "l_1234567890abcdef0123",
    });
    expect(landingFor("https://evil.example/admin")).toEqual({ tab: "home" });
  });

  it("survives a payload that is not a string", () => {
    expect(landingFor(undefined)).toEqual({ tab: "home" });
    expect(landingFor(null as unknown as string)).toEqual({ tab: "home" });
    expect(landingFor(42 as unknown as string)).toEqual({ tab: "home" });
  });

  it("ignores a query string or a fragment", () => {
    expect(landingFor("/children/l_1234567890abcdef0123?from=push#top")).toEqual({
      tab: "children",
      learnerId: "l_1234567890abcdef0123",
    });
  });
});
