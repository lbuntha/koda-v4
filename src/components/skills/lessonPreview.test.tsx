import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { LessonPreview } from "./SkillManagerPage";
import { loadSkill } from "../../skills/registry";
import { markHowToPlaySeen } from "../../skills/kit";

/**
 * Switching the preview between two lessons that share an engine.
 *
 * The preview mounted one SkillHost and swapped its lesson, so React kept the
 * round of the first lesson: "Read the Ruler" showed "Measure It"'s placing
 * question under its own title. Keyed on the lesson, each preview starts its
 * own round, as the learner app always did.
 */
describe("LessonPreview", () => {
  it("starts a new round when the lesson changes, even on the same engine", async () => {
    const skill = (await loadSkill("measurement"))!;
    for (const id of ["ruler-read", "ruler-place"]) markHowToPlaySeen(`measurement/${id}`);
    const place = skill.lessons.find((l) => l.id === "measure-it")!;
    const read = skill.lessons.find((l) => l.id === "read-the-ruler")!;
    expect(place.activity).toBe(read.activity);

    const view = render(<LessonPreview lesson={place} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: /Move it to the ruler first/ })).toBeTruthy());

    view.rerender(<LessonPreview lesson={read} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: /^How long is the \w+\?$/ })).toBeTruthy());
    expect(screen.queryByText(/Move it to the ruler first/)).toBeNull();
  });
});
