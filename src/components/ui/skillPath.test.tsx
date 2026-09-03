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
