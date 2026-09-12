import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UISkillPath } from "./UISkillPath";

describe("UISkillPath access tiers", () => {
  it("labels free and premium lessons independently of their access state", () => {
    const onSelect = vi.fn();
    render(
      <UISkillPath
        onSelect={onSelect}
        items={[
          { id: "free", title: "First steps", state: "available", tier: "free" },
          { id: "paid-open", title: "Big challenge", state: "available", tier: "premium" },
          { id: "paid-locked", title: "Expert round", state: "premium", tier: "premium" },
        ]}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "First steps (Free)" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      (screen.getByRole("button", { name: "Big challenge (Premium)" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (
        screen.getByRole("button", {
          name: "Expert round (Premium) (subscription required)",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(screen.getAllByText("Premium")).toHaveLength(2);

    fireEvent.click(
      screen.getByRole("button", { name: "Expert round (Premium) (subscription required)" }),
    );
    expect(onSelect).toHaveBeenCalledWith("paid-locked");
  });
});

describe("a padlock that explains itself", () => {
  it("says what opens the stone, in the label and to a screen reader", () => {
    render(
      <UISkillPath
        onSelect={vi.fn()}
        items={[
          {
            id: "touching",
            title: "Which Tiles Touch a Tile",
            state: "locked",
            tier: "free",
            note: "Unlocks after Counting in a Row",
          },
          { id: "edges", title: "Edges and Corners", state: "locked", tier: "free" },
        ]}
      />,
    );

    expect(screen.getByText("Unlocks after Counting in a Row")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Which Tiles Touch a Tile (Free) (locked: Unlocks after Counting in a Row)",
      }),
    ).toBeTruthy();

    // The stone behind it is locked by the one in front, which the order
    // already says — thirty repetitions is a wall of text over a wall.
    expect(screen.getByRole("button", { name: "Edges and Corners (Free) (locked)" })).toBeTruthy();
  });
});
