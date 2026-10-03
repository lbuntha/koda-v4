import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UITabBar } from "./UIAppShell";

/*
 * The phone hides its tab bar inside a book with CSS. It used to find the bar by
 * its label, nav[aria-label="Main"] — but the label is translated, so on a phone
 * set to Khmer nothing matched and the bar stayed. It is found by attribute now.
 */
describe("hiding the phone's tab bar", () => {
  it("marks the bar with an attribute that does not change with the language", () => {
    const { container } = render(<UITabBar items={[]} activeId="home" onSelect={() => {}} />);
    expect(container.querySelector("[data-tab-bar] nav")).not.toBeNull();
  });

  it("is never selected by a translated label", () => {
    const css = readFileSync("src/index.css", "utf8");
    expect(css).not.toMatch(/nav\[aria-label=/);
    expect(css).toContain("[data-mobile-tabbar-hidden] [data-tab-bar]");
  });
});
