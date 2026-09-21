import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UIAvatar } from "../ui";
import { AvatarArtChoices } from "./AvatarArtChoices";
import { ProfileEditModal } from "./ProfileEditModal";

describe("Art-backed profile avatars", () => {
  it("renders a saved Art avatar through the shared avatar component", () => {
    render(<UIAvatar name="StarFox" seed="art:avatar-fox" />);

    expect(screen.getByTitle("Fox avatar")).toBeTruthy();
    expect(screen.getByRole("img", { name: "StarFox avatar" }).className).toContain("rounded-full");
    expect(document.querySelector("img")).toBeNull();
  });

  it("uses the same circular frame for classic DiceBear avatars", () => {
    render(<UIAvatar name="Classic" seed="a_classic" />);

    expect(screen.getByRole("img", { name: "Classic avatar" }).className).toContain("rounded-full");
  });

  it("offers the live avatars category and returns an encoded choice", () => {
    const onSelect = vi.fn();
    render(<AvatarArtChoices selectedSeed="" onSelect={onSelect} />);

    const artChoices = screen.getByRole("radiogroup", { name: "Koda Art avatars" });
    expect(within(artChoices).getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radiogroup", { name: "Classic avatars" })).toBeTruthy();
    fireEvent.click(within(artChoices).getByRole("radio", { name: "Choose Fox" }));
    expect(onSelect).toHaveBeenCalledWith("art:avatar-fox");
  });

  it("keeps the existing DiceBear collection and can refresh it", () => {
    render(<AvatarArtChoices currentSeed="a_existing_seed" selectedSeed="a_existing_seed" onSelect={() => undefined} />);

    const before = within(screen.getByRole("radiogroup", { name: "Classic avatars" }))
      .getAllByRole("radio")
      .map((choice) => choice.getAttribute("aria-label"));
    expect(before).toHaveLength(8);
    expect(screen.getByRole("radio", { name: "Choose Current avatar" }).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "New choices" }));
    const after = within(screen.getByRole("radiogroup", { name: "Classic avatars" }))
      .getAllByRole("radio")
      .map((choice) => choice.getAttribute("aria-label"));
    expect(after).toHaveLength(8);
    expect(after).not.toEqual(before);
  });

  it("saves the selected Art avatar from Edit profile", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ProfileEditModal
        isOpen
        currentName="Jutta"
        currentSeed="a_existing_seed"
        onClose={() => undefined}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Choose Fox" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      displayName: "Jutta",
      avatarSeed: "art:avatar-fox",
    }));
  });
});
