import { afterEach, expect, it, vi } from "vitest";
import { say, stop } from "./voice";

const { playBase64Pcm, speakWebSpeech } = vi.hoisted(() => ({
  playBase64Pcm: vi.fn(),
  speakWebSpeech: vi.fn(),
}));

vi.mock("../utils/audio", () => ({
  isVoiceEnabled: () => true,
  playBase64Pcm,
  speakWebSpeech,
}));
vi.mock("../lib/voiceClips", () => ({
  voiceFloorHeld: () => false,
  playClip: () => false,
  stopClip: vi.fn(),
}));
vi.mock("../lib/tutorApi", () => ({ tutorHeaders: async () => ({}) }));

afterEach(() => {
  stop();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("discards a speech response that arrives after leaving the question", async () => {
  let respond!: (response: Response) => void;
  const fetchSpeech = vi.fn((_url: string, _request: RequestInit) =>
    new Promise<Response>((resolve) => { respond = resolve; })
  );
  vi.stubGlobal("fetch", fetchSpeech);

  const speaking = say("What animal is Pip?", "en");
  await vi.waitFor(() => expect(fetchSpeech).toHaveBeenCalledOnce());
  stop();
  expect(fetchSpeech.mock.calls[0][1].signal?.aborted).toBe(true);
  respond(Response.json({ audio: "late audio" }));

  await expect(speaking).resolves.toBe(false);
  expect(playBase64Pcm).not.toHaveBeenCalled();
  expect(speakWebSpeech).not.toHaveBeenCalled();
});

it("stops server audio already playing when a child answers", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ audio: "question audio" })));
  const source = { onended: null, stop: vi.fn() };
  playBase64Pcm.mockReturnValueOnce(source);
  const speaking = say("What animal is Pip?", "en");
  await vi.waitFor(() => expect(playBase64Pcm).toHaveBeenCalledOnce());

  stop();

  expect(source.stop).toHaveBeenCalledOnce();
  await expect(speaking).resolves.toBe(false);
});
