import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UIAvatar } from "../ui";
import { AvatarArtChoices } from "./AvatarArtChoices";
import { ProfileEditModal } from "./ProfileEditModal";

describe("Art-backed profile avatars", () => {
  it("renders a saved Art avatar through the shared avatar component", () => {
    render(<UIAvatar name="StarFox" seed="art:avatar-fox" />);

    expect(screen.getByTitle("Fox avatar")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });

  it("offers the live avatars category and returns an encoded choice", () => {
    const onSelect = vi.fn();
    render(<AvatarArtChoices selectedSeed="" onSelect={onSelect} />);

    expect(screen.getAllByRole("radio")).toHaveLength(5);
    fireEvent.click(screen.getByRole("radio", { name: "Choose Fox" }));
    expect(onSelect).toHaveBeenCalledWith("art:avatar-fox");
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
