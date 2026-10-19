import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PuzzleCanvas } from "./ui/PieceView";
import { PuzzleEditor, BLANK_DRAFT } from "./studio/PuzzleEditor";
import { photosIn, prefetchPuzzlePhotos } from "./photos";
import type { Puzzle } from "./types";

const lib = vi.hoisted(() => ({ photoUrl: vi.fn(), uploadPhoto: vi.fn(), knownPhotoUrl: vi.fn(() => null as string | null) }));
vi.mock("../library/photos", async () => {
  const actual = await vi.importActual<typeof import("../library/photos")>("../library/photos");
  return { ...actual, photoUrl: lib.photoUrl, uploadPhoto: lib.uploadPhoto, knownPhotoUrl: lib.knownPhotoUrl };
});

const KEY = `photo-${"a".repeat(64)}`;
const photo = { kind: "photo" as const, id: KEY, name: "mango" };

beforeEach(() => {
  lib.photoUrl.mockReset();
  lib.uploadPhoto.mockReset();
  lib.knownPhotoUrl.mockReturnValue(null);
});

describe("a photo piece", () => {
  it("shows the photo once it arrives, whole, with its name for a screen reader, next to a drawing", async () => {
    lib.photoUrl.mockResolvedValue("blob:mango");
    render(<PuzzleCanvas label="Puzzle" pieces={[photo, { kind: "op", op: "+" }, { kind: "word", text: "pie" }]} />);
    const tile = await screen.findByRole("img", { name: "mango" });
    await waitFor(() => expect(tile.querySelector("img")?.getAttribute("src")).toBe("blob:mango"));
    expect(tile.querySelector("img")?.className).toContain("object-contain");
    expect(lib.photoUrl).toHaveBeenCalledWith(KEY, "rebus/images");
  });

  it("sizes from the piece, and shows its name instead of a broken picture when it cannot be had", async () => {
    lib.photoUrl.mockResolvedValue(null);
    render(<PuzzleCanvas label="Puzzle" pieces={[{ ...photo, scale: "big" }]} />);
    await screen.findByText("mango");
    expect(screen.queryByRole("img", { name: "mango" })).toBeNull();
  });
});

describe("photos with the published list", () => {
  const puzzle = (pieces: Puzzle["pieces"]): Puzzle => ({ id: "x", category: "food", ages: [6, 12], difficulty: 1, trick: "compound", pieces, answer: "Mango pie", accepts: [], explanation: "mango + pie.", source: "official" });

  it("finds every photo once, and fetches them without ever failing loudly", async () => {
    const list = [puzzle([photo, { kind: "op", op: "+" }, { kind: "icon", id: "rebus-pie", name: "pie" }]), puzzle([photo, { kind: "photo", id: `photo-${"b".repeat(64)}`, name: "kiwi" }])];
    expect(photosIn(list)).toEqual([KEY, `photo-${"b".repeat(64)}`]);
    lib.photoUrl.mockRejectedValueOnce(new Error("offline")).mockResolvedValue("blob:x");
    await expect(prefetchPuzzlePhotos(list)).resolves.toBeUndefined();
    expect(lib.photoUrl).toHaveBeenCalledTimes(2);
  });
});

describe("adding a photo in the editor", () => {
  const mount = () => render(<PuzzleEditor initial={{ ...BLANK_DRAFT }} onSave={async () => ""} onCancel={() => {}} />);

  it("uploads from the computer at piece size, names it from the file, and lets the author resize it", async () => {
    lib.uploadPhoto.mockResolvedValue(KEY);
    lib.photoUrl.mockResolvedValue("blob:mango");
    mount();
    const file = new File(["x"], "ripe-mango.jpg", { type: "image/jpeg" });
    await act(async () => void fireEvent.change(screen.getByLabelText("Choose a photo file"), { target: { files: [file] } }));
    await waitFor(() => expect(lib.uploadPhoto).toHaveBeenCalledWith(file, "rebus/studio/images", 640));
    const name = (await screen.findByLabelText("Piece 1 is read as")) as HTMLInputElement;
    expect(name.value).toBe("ripe mango");
    fireEvent.click(screen.getByRole("button", { name: "Big" }));
    expect(screen.getByRole("button", { name: "Big" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Normal" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("says why when the photo could not be added, and adds nothing", async () => {
    lib.uploadPhoto.mockRejectedValue(new Error("That file is not a photo."));
    mount();
    await act(async () => void fireEvent.change(screen.getByLabelText("Choose a photo file"), { target: { files: [new File(["x"], "a.txt")] } }));
    await screen.findByText("That file is not a photo.");
    expect(screen.queryByLabelText("Piece 1 is read as")).toBeNull();
  });
});
