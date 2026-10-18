import { act, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ArtStore } from "../../lib/sync/artStore";
import { PieceView } from "../ui/PieceView";
import { ICON_ART } from "./library";
import { bundledSvg, useIconMarkup, useRebusIcons } from "./useRebusIcons";

const art = (id: string, markup: string) => ({ id, category: "rebus", markup, rev: 1, modified: 1 });
const OVERRIDE = '<svg viewBox="0 0 64 64"><rect data-test="override" x="8" y="8" width="48" height="48" fill="#6B46C1"/></svg>';

beforeEach(async () => {
  await ArtStore.load();
  for (const id of ["rebus-honey", "rebus-yeti"]) await ArtStore.remove(id);
});

describe("the drawing for an icon", () => {
  it("is the built-in one until the Art library has its own", () => {
    const { result } = renderHook(() => useIconMarkup("rebus-honey"));
    expect(result.current).toBe(bundledSvg("honey"));
    expect(result.current).toContain("<svg");
  });

  it("is the Art library's version once an admin has edited it, on screen at once, and the built-in one again when it is removed", async () => {
    const { result } = renderHook(() => useIconMarkup("rebus-honey"));
    await act(async () => ArtStore.put(art("rebus-honey", OVERRIDE)));
    expect(result.current).toBe(OVERRIDE);
    await act(async () => ArtStore.remove("rebus-honey"));
    expect(result.current).toBe(bundledSvg("honey"));
  });

  it("has nothing for an id nobody drew, so a piece shows its name", () => {
    expect(renderHook(() => useIconMarkup("rebus-nothing")).result.current).toBeNull();
    render(<PieceView piece={{ kind: "icon", id: "rebus-nothing", name: "a yeti" }} />);
    expect(screen.getByText("a yeti")).toBeTruthy();
  });

  it("draws the edited version inside a puzzle", async () => {
    const { container } = render(<PieceView piece={{ kind: "icon", id: "rebus-honey", name: "honey" }} />);
    // The sanitiser keeps drawing attributes and drops anything else, so the override is found by its fill.
    expect(container.querySelector('rect[fill="#6B46C1"]')).toBeNull();
    await act(async () => ArtStore.put(art("rebus-honey", OVERRIDE)));
    expect(container.querySelector('rect[fill="#6B46C1"]')).not.toBeNull();
    expect(screen.getByRole("img", { name: "honey" })).toBeTruthy();
  });
});

describe("every drawing", () => {
  it("lists the built-in ones and any added through the Art library, saying which is which", async () => {
    const { result } = renderHook(() => useRebusIcons());
    expect(result.current).toHaveLength(Object.keys(ICON_ART).length);
    expect(result.current.every((i) => i.builtIn && !i.inArt)).toBe(true);

    await act(async () => {
      await ArtStore.put(art("rebus-yeti", OVERRIDE));
      await ArtStore.put(art("rebus-honey", OVERRIDE));
      await ArtStore.put({ ...art("not-rebus", OVERRIDE) });
    });
    const byId = Object.fromEntries(result.current.map((i) => [i.id, i]));
    expect(byId["rebus-yeti"]).toMatchObject({ name: "yeti", builtIn: false, inArt: true, markup: OVERRIDE });
    expect(byId["rebus-honey"]).toMatchObject({ builtIn: true, inArt: true, markup: OVERRIDE });
    expect(byId["not-rebus"]).toBeUndefined();
    expect(result.current).toHaveLength(Object.keys(ICON_ART).length + 1);
    expect(result.current.map((i) => i.name)).toEqual([...result.current.map((i) => i.name)].sort());
    await ArtStore.remove("not-rebus");
  });
});
