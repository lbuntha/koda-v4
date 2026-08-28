import { describe, expect, it } from "vitest";
import { resolveDrop, type Built, type PlaceKey } from "./Base10Foundry";

/**
 * The rule the manipulative teaches, tested without a browser.
 *
 * Dragging itself needs a real pointer and real layout, so it is checked on a
 * device. What can be pinned down here is the part that carries the teaching:
 * a block belongs to its own place, and dropping it somewhere else is refused
 * rather than quietly rounded to something helpful.
 */
const LIMITS: Record<PlaceKey, number> = { hundreds: 9, tens: 19, ones: 19 };
const empty: Built = { hundreds: 0, tens: 0, ones: 0 };

describe("resolveDrop", () => {
  it("adds a block dropped into its own column", () => {
    const r = resolveDrop(empty, { kind: "tens", from: "supply" }, "tens", LIMITS);
    expect(r.accepted).toBe(true);
    expect(r.built.tens).toBe(1);
    expect(r.change).toBe("added");
  });

  it("refuses a ten dropped into the ones column", () => {
    // The point of the activity: place value decides where a block may go.
    const r = resolveDrop(empty, { kind: "tens", from: "supply" }, "ones", LIMITS);
    expect(r.accepted).toBe(false);
    expect(r.built).toEqual(empty);
  });

  it("refuses a one dropped into the tens column", () => {
    const r = resolveDrop(empty, { kind: "ones", from: "supply" }, "tens", LIMITS);
    expect(r.accepted).toBe(false);
    expect(r.built).toEqual(empty);
  });

  it("removes a block dragged out of a column and dropped away", () => {
    const start: Built = { hundreds: 0, tens: 3, ones: 0 };
    const r = resolveDrop(start, { kind: "tens", from: "tens" }, null, LIMITS);
    expect(r.accepted).toBe(true);
    expect(r.built.tens).toBe(2);
    expect(r.change).toBe("removed");
  });

  it("never drops a column below zero", () => {
    const r = resolveDrop(empty, { kind: "ones", from: "ones" }, null, LIMITS);
    expect(r.built.ones).toBe(0);
  });

  it("does nothing when a block from the supply is dropped on no column", () => {
    const r = resolveDrop(empty, { kind: "ones", from: "supply" }, null, LIMITS);
    expect(r.accepted).toBe(true);
    expect(r.built).toEqual(empty);
    expect(r.change).toBeUndefined();
  });

  it("puts a block back when it is dropped on the column it came from", () => {
    const start: Built = { hundreds: 0, tens: 0, ones: 4 };
    const r = resolveDrop(start, { kind: "ones", from: "ones" }, "ones", LIMITS);
    expect(r.accepted).toBe(true);
    expect(r.built).toEqual(start);
    expect(r.change).toBeUndefined();
  });

  it("refuses a block that would take a column past its limit", () => {
    const full: Built = { hundreds: 9, tens: 0, ones: 0 };
    const r = resolveDrop(full, { kind: "hundreds", from: "supply" }, "hundreds", LIMITS);
    expect(r.accepted).toBe(false);
    expect(r.built.hundreds).toBe(9);
  });

  it("leaves the other columns untouched", () => {
    const start: Built = { hundreds: 1, tens: 2, ones: 3 };
    const r = resolveDrop(start, { kind: "ones", from: "supply" }, "ones", LIMITS);
    expect(r.built.hundreds).toBe(1);
    expect(r.built.tens).toBe(2);
    expect(r.built.ones).toBe(4);
  });
});
