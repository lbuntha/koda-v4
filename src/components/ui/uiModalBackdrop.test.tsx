import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UIModal } from "./ThemeUI";

/** The overlay is the portalled element the title sits inside. */
const overlayOf = (title: string) =>
  screen.getByText(title).closest(".fixed") as HTMLElement;

describe("UIModal backdrop", () => {
  it("dims the page by default", () => {
    render(
      <UIModal isOpen onClose={() => undefined} title="Edit profile">
        Form
      </UIModal>,
    );

    expect(overlayOf("Edit profile").className).toContain("backdrop-blur");
  });

  it("leaves the page visible with backdrop none, in the same place", () => {
    render(
      <UIModal isOpen onClose={() => undefined} title="Turn on notifications?" backdrop="none">
        Prompt
      </UIModal>,
    );

    const overlay = overlayOf("Turn on notifications?");
    expect(overlay.className).not.toContain("bg-slate-950");
    expect(overlay.className).not.toContain("backdrop-blur");
    expect(overlay.className).toContain("items-end");
    expect(overlay.className).toContain("rail:items-center");
  });
});
