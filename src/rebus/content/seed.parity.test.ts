import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ICON_IDS } from "../icons/library";
import { OFFICIAL_PUZZLES } from "./index";

const server = (name: string) => JSON.parse(readFileSync(join(__dirname, "../../../server/app", name), "utf8")) as unknown;

describe("the server's copies", () => {
  it("seeds exactly the puzzles the app ships: run `npx tsx scripts/generate-rebus-seed.ts` after changing any", () => {
    expect(server("rebus_seed.json")).toEqual(JSON.parse(JSON.stringify(OFFICIAL_PUZZLES)));
  });

  it("checks puzzles against exactly the icons the app draws: run `npx tsx scripts/generate-rebus-icons.ts` after drawing one", () => {
    expect(new Set(server("rebus_icons.json") as string[])).toEqual(ICON_IDS);
  });
});
