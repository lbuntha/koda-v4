import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NO_SUGGESTIONS } from "./noSuggestions";

describe("answer boxes", () => {
  it("ask the keyboard for no suggestions, corrections or completions", () => {
    render(<input aria-label="answer" {...NO_SUGGESTIONS} />);
    const box = screen.getByLabelText("answer");
    expect(box.getAttribute("autocomplete")).toBe("off");
    expect(box.getAttribute("autocorrect")).toBe("off");
    expect(box.getAttribute("autocapitalize")).toBe("none");
    expect(box.getAttribute("spellcheck")).toBe("false");
    expect(box.getAttribute("data-gramm")).toBe("false");
  });
});
