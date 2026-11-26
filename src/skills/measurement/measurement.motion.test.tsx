import { describe, expect, it, vi } from "vitest";

/* The test browser asks for reduced motion; here it does not, so the switch alone decides. */
vi.mock("../kit/motion", async (load) => ({ ...(await load<typeof import("../kit/motion")>()), useMotionOK: () => true }));

const { renderActivity } = await import("../kit/testing");
const { markHowToPlaySeen } = await import("../kit");
const { skill } = await import(".");

describe("instrument_motion", () => {
  it("off makes the beam, water, needle and thermometer jump straight to their value", () => {
    for (const id of ["balance", "jug", "pour", "scale", "thermo"]) markHowToPlaySeen(`measurement/${id}`);
    for (const enabled of [true, false]) {
      const features = { instrument_motion: enabled };
      const b = renderActivity(skill.activities.balance, { skillId: "measurement", features, params: { question: { mode: "compare" } } });
      expect(b.screen.getByTestId("balance").closest("[data-motion]")!.getAttribute("data-motion")).toBe(enabled ? "on" : "off");
      b.unmount();
      const w = renderActivity(skill.activities.capacity, { skillId: "measurement", features, params: { question: { mode: "jug" } } });
      expect(w.screen.getByTestId("jug").closest("[data-motion]")!.getAttribute("data-motion")).toBe(enabled ? "on" : "off");
      w.unmount();
      const d = renderActivity(skill.activities.scale, { skillId: "measurement", features, params: { question: { mode: "read" } } });
      expect(d.screen.getByTestId("dial").closest("[data-motion]")!.getAttribute("data-motion")).toBe(enabled ? "on" : "off");
      d.unmount();
      const t = renderActivity(skill.activities.thermo, { skillId: "measurement", features, params: { question: { mode: "read" } } });
      expect(t.screen.getByTestId("thermometer").closest("[data-motion]")!.getAttribute("data-motion")).toBe(enabled ? "on" : "off");
      t.unmount();
    }
  });
});
