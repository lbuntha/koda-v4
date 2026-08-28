import { describe, expect, it } from "vitest";

import {
  EnvelopeFollower,
  beatMs,
  mascotStateFor,
  talkingMouth,
  type LiveSignals,
} from "./kodaLive";

/**
 * What the face is allowed to claim.
 *
 * The rule this exists to protect is that the mascot may only show what is
 * true. A child who sees Koda listening and is not heard learns that the app
 * lies, and that is worse than a face that does nothing — so the muted case and
 * the not-yet-connected case are the ones worth pinning hardest.
 */

const session = (over: Partial<LiveSignals> = {}): LiveSignals => ({
  status: "connected",
  userEnergy: 0,
  modelEnergy: 0,
  ...over,
});

describe("what the session makes the face do", () => {
  it("never claims to be listening while the microphone is muted", () => {
    // Status still says listening — the session has not torn anything down —
    // but nothing is being heard, so the face must not say otherwise.
    expect(mascotStateFor(session({ status: "listening", muted: true }))).toBe("idle");
    expect(mascotStateFor(session({ userEnergy: 0.9, muted: true }))).toBe("idle");
  });

  it("still speaks while muted, because that is Koda's own voice", () => {
    expect(mascotStateFor(session({ status: "speaking", muted: true }))).toBe("speaking");
  });

  it("lets Koda's voice win when both meters are live", () => {
    // An open mic hears the speaker. A face that flickered between the two
    // would read as broken rather than as a conversation.
    expect(mascotStateFor(session({ userEnergy: 0.8, modelEnergy: 0.5 }))).toBe("speaking");
  });

  it("thinks while connecting, and waits when there is nothing open", () => {
    expect(mascotStateFor(session({ status: "connecting" }))).toBe("thinking");
    expect(mascotStateFor(session({ status: "disconnected" }))).toBe("idle");
    expect(mascotStateFor(session({ status: "error", userEnergy: 0.9 }))).toBe("idle");
  });

  it("listens on the child's voice, and waits in a quiet room", () => {
    expect(mascotStateFor(session({ userEnergy: 0.4 }))).toBe("listening");
    expect(mascotStateFor(session({ status: "listening" }))).toBe("listening");
    expect(mascotStateFor(session())).toBe("idle");
  });

  it("follows the browser voice when Gemini audio is not what is playing", () => {
    // The speech-synthesis fallback is still Koda talking, as far as a child is
    // concerned, so the face has to move for it too.
    expect(mascotStateFor(session({ fallbackSpeaking: true }))).toBe("speaking");
  });

  it("ignores room noise below the floor, so the mouth does not stutter", () => {
    expect(mascotStateFor(session({ userEnergy: 0.02 }))).toBe("idle");
    expect(mascotStateFor(session({ modelEnergy: 0.02 }))).toBe("idle");
  });
});

describe("lip-sync", () => {
  it("shuts the mouth when the voice actually stops", () => {
    expect(talkingMouth(0, 0.8, true)).toBe("talkClosed");
    expect(talkingMouth(0.02, 0.8, true)).toBe("talkClosed");
  });

  it("shuts it on the closed half of every beat, however loud the voice is", () => {
    // The failure this prevents: the meter falls slower than a syllable, so a
    // mouth driven by level alone sits wide open for the whole sentence.
    expect(talkingMouth(0.9, 0.9, false)).toBe("talkClosed");
    expect(talkingMouth(0.9, 0.9, true)).toBe("talkWide");
  });

  it("measures loud against this speaker, not against an absolute", () => {
    // A quiet voice still gets a wide mouth on its own emphasis; a hot mic does
    // not sit permanently wide.
    expect(talkingMouth(0.2, 0.22, true)).toBe("talkWide");
    expect(talkingMouth(0.2, 0.95, true)).toBe("talkOpen");
  });

  it("beats faster when the voice is louder, so the cycle is not metronomic", () => {
    expect(beatMs(1)).toBeLessThan(beatMs(0));
    // Four to seven syllables a second is 70–110ms a beat.
    expect(beatMs(0)).toBeLessThanOrEqual(110);
    expect(beatMs(1)).toBeGreaterThanOrEqual(65);
  });
});

/**
 * The envelope is the part that turns a spiky meter into something a mouth can
 * follow. Both halves of its asymmetry are load-bearing, so both are pinned.
 */
describe("the envelope follower", () => {
  it("opens faster than it closes", () => {
    // From the same starting level, one step towards sound must cover more
    // ground than one step towards silence. That asymmetry is the whole point:
    // a mouth that shut as fast as it opened would slam on every consonant.
    const start = 0.5;

    const rising = new EnvelopeFollower();
    rising.follow(start, 10_000); // settle at the starting level
    const gained = rising.follow(1, 50) - start;

    const falling = new EnvelopeFollower();
    falling.follow(start, 10_000);
    const lost = start - falling.follow(0, 50);

    expect(gained).toBeGreaterThan(lost * 1.5);
  });

  it("gives the same shape whatever the frame rate", () => {
    // A browser at 30fps and one at 120fps must produce the same envelope, or a
    // slow machine gets a mouth that closes at half speed.
    const coarse = new EnvelopeFollower();
    const fine = new EnvelopeFollower();
    for (let t = 0; t < 400; t += 33) coarse.follow(1, 33);
    for (let t = 0; t < 400; t += 8) fine.follow(1, 8);
    expect(Math.abs(coarse.value - fine.value)).toBeLessThan(0.02);
  });

  it("cannot be jumped past its target by one enormous frame", () => {
    // A backgrounded tab returns with a `dt` of many seconds.
    const envelope = new EnvelopeFollower();
    expect(envelope.follow(0.5, 60_000)).toBeLessThanOrEqual(0.5);
  });
});
