import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { LearnHub } from "./LearnHub";

/** A shelf with state of its own — what Library and Trace hold while a book or an item is open. */
function Shelf({ onOpen }: { onOpen(open: boolean): void }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" onClick={() => { setOpen(true); onOpen(true); }}>
      {open ? "inside the item" : "on the shelf"}
    </button>
  );
}

function Host() {
  const [immersed, setImmersed] = useState(false);
  return (
    <LearnHub value="trace" onChange={() => {}} immersed={immersed}>
      <Shelf onOpen={setImmersed} />
    </LearnHub>
  );
}

describe("LearnHub", () => {
  it("keeps the page's own state when an activity opens and the switcher steps aside", () => {
    render(<Host />);
    expect(screen.getByRole("tablist")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "on the shelf" }));

    // The switcher is gone, and the item is still open — not reset to the shelf.
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("button", { name: "inside the item" })).toBeTruthy();
  });
});
