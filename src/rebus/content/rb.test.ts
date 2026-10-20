import { describe, expect, it } from "vitest";
import { rb } from "./rb";

describe("the short way to write a puzzle", () => {
  it("reads drawings joined by a sign, and makes the sentence from what each is read as", () => {
    const p = rb("Football", "foot + ball");
    expect(p.pieces).toEqual([
      { kind: "icon", id: "rebus-foot", name: "foot" },
      { kind: "op", op: "+" },
      { kind: "icon", id: "rebus-ball", name: "ball" },
    ]);
    expect(p).toMatchObject({ why: "foot + ball = football.", trick: "compound", difficulty: 1, accepts: [] });
  });

  it("reads a drawing as another word, big or small, and an and-sign", () => {
    expect(rb("Soft ball", "cloud=soft & ball").pieces).toEqual([
      { kind: "icon", id: "rebus-cloud", name: "soft" },
      { kind: "op", op: "&" },
      { kind: "icon", id: "rebus-ball", name: "ball" },
    ]);
    expect(rb("Big fish", "*fish=big_fish").pieces[0]).toMatchObject({ scale: "big", name: "big fish" });
    expect(rb("Little fish", "~fish").pieces[0]).toMatchObject({ scale: "small" });
  });

  it("reads written words (with spaces inside), styled words and stacked words", () => {
    expect(rb("Skiing", 'ski + "ING"').pieces[2]).toEqual({ kind: "word", text: "ING" });
    expect(rb("Big deal", '"DEAL"|big')).toMatchObject({ trick: "style", pieces: [{ kind: "word", text: "DEAL", style: "big" }] });
    expect(rb("Out of order", '"OUT OF" + "ORDER"').pieces.map((p) => (p.kind === "word" ? p.text : p.kind))).toEqual(["OUT OF", "op", "ORDER"]);
    expect(rb("Man overboard", "[MAN/BOARD]")).toMatchObject({ trick: "position", pieces: [{ kind: "stack", top: "MAN", bottom: "BOARD" }] });
  });

  it("puts nothing between pieces that are only spaced apart, and takes options", () => {
    expect(rb("Dog eat dog", 'dog "eat" dog').pieces.map((p) => p.kind)).toEqual(["icon", "word", "icon"]);
    const hard = rb("Haiti", "hay + tea", { d: 3, t: "sound-alike", a: ["haiti"] });
    expect(hard).toMatchObject({ difficulty: 3, trick: "sound-alike", accepts: ["haiti"], why: "hay + tea, said fast, sounds like haiti." });
    expect(rb("Pun", "ball", { why: "A custom line." }).why).toBe("A custom line.");
  });

  it("refuses a piece it cannot read, or a style it does not know", () => {
    expect(() => rb("X", "Foot Ball")).toThrow(/Cannot read/);
    expect(() => rb("X", '"A"|sparkly')).toThrow(/Unknown word style/);
  });
});
