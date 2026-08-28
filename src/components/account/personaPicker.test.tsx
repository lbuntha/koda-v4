import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * Choosing a teacher.
 *
 * Two people choose from two screens — a parent on the Children page, a student
 * on their own Settings — so this is the component both use, and what is worth
 * pinning is the three things that are easy to get wrong when a roster changes
 * under you: a single character is not a choice, a retired one must not leave
 * the picker empty, and choosing is what the caller is told about.
 */

const roster = vi.fn();
vi.mock("../../lib/usePersona", () => ({ usePersonaRoster: () => roster() }));

import { PersonaPicker } from "./PersonaPicker";

const koda = {
  personaId: "koda",
  name: "Koda",
  emoji: "🦭",
  blurb: "Warm and patient.",
  voice: "Aoede",
  minAge: 4,
  maxAge: 8,
};
const vega = {
  personaId: "vega",
  name: "Ms Vega",
  emoji: "🔭",
  blurb: "Precise and calm.",
  voice: "Kore",
  minAge: 8,
  maxAge: 12,
};

beforeEach(() => roster.mockReset());
afterEach(cleanup);

describe("picking a teacher", () => {
  it("draws nothing when a deployment runs one character", () => {
    roster.mockReturnValue([koda]);
    const { container } = render(<PersonaPicker value={null} onChange={() => undefined} />);
    // One option is not a choice and should not be presented as one.
    expect(container.innerHTML).toBe("");
  });

  it("marks the chosen one, and names each so a parent can tell them apart", () => {
    roster.mockReturnValue([koda, vega]);
    render(<PersonaPicker value="vega" onChange={() => undefined} />);

    expect(screen.getByRole("radio", { name: /Ms Vega/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Koda/ }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Precise and calm.")).toBeTruthy();
    expect(screen.getByText("ages 8–12")).toBeTruthy();
  });

  it("falls back to the default when the chosen character no longer exists", () => {
    roster.mockReturnValue([koda, vega]);
    // An operator retired "rio" while this child was pointed at it. The picker
    // must show what they will actually get, not nothing at all.
    render(<PersonaPicker value="rio" onChange={() => undefined} />);

    expect(screen.getByRole("radio", { name: /Koda/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("shows the default as chosen when nobody has picked", () => {
    roster.mockReturnValue([koda, vega]);
    render(<PersonaPicker value={null} onChange={() => undefined} />);

    expect(screen.getByRole("radio", { name: /Koda/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("reports a change, and stays quiet when the same one is tapped again", () => {
    roster.mockReturnValue([koda, vega]);
    const onChange = vi.fn();
    render(<PersonaPicker value="koda" onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /Ms Vega/ }));
    expect(onChange).toHaveBeenCalledWith("vega");

    // Re-tapping the current one is not a change: it would write a document and
    // sync it for nothing.
    onChange.mockClear();
    fireEvent.click(screen.getByRole("radio", { name: /Koda/ }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

/**
 * The faces.
 *
 * A character's colour is derived, not stored, so nobody has to pick one before
 * they can save — which only works if the derivation is stable. A teacher that
 * changed colour between the roster and the picker would undo the reason for
 * having a colour at all.
 */
describe("how a character looks", () => {
  it("gives one id the same tint every time it is asked", async () => {
    const { tintFor } = await import("./CharacterVisuals");
    expect(tintFor("vega")).toBe(tintFor("vega"));
    expect(tintFor("vega").bg).toEqual(tintFor("vega").bg);
  });

  it("keeps the palette to the six that were checked in both themes", async () => {
    const { tintFor } = await import("./CharacterVisuals");
    const seen = new Set(
      Array.from({ length: 200 }, (_, i) => tintFor(`character-${i}`).bg),
    );
    expect(seen.size).toBeLessThanOrEqual(6);
  });
});
