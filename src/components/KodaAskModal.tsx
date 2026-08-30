import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Mic, Send, Sparkles } from "lucide-react";

import { SvgAsset } from "../assets/svg";
import { askKodaInWriting, type KodaContext, type KodaTurn } from "../lib/tutorApi";
import { KodaConversation } from "../lib/koda/conversationLog";
import { currentPersonaId } from "../lib/personas";
import { themeSystem } from "../lib/themeSystem";
import { useKoda } from "../lib/useKoda";
import { usePersona } from "../lib/usePersona";
import { playSound } from "../utils/audio";
import { UIButton, UIModal } from "./ui";

/**
 * Ask Koda in writing, and the door back to talking.
 *
 * Koda is a coach a child *talks* to, so a tap opens the spoken session
 * wherever this deployment runs it — see `preferredKodaMode`. This is the other
 * half, and it is reached two ways: deliberately, from the keyboard button
 * inside the voice coach, or straight away where an operator has switched the
 * voice coach off. Before it existed, that second case meant no Koda at all.
 *
 * Which halves exist is the operator's decision — `ai.chat` and `ai.liveVoice`
 * on the Ask Koda page — so the way back to voice is drawn only when there is
 * one to go back to.
 */
export const KodaAskModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  /** Hands over to the live voice coach, which is its own full-screen surface. */
  onStartVoice: () => void;
  /** What the learner is looking at, so a question has somewhere to land. */
  context?: KodaContext;
}> = ({ isOpen, onClose, onStartVoice, context }) => {
  const koda = useKoda();
  // The teacher this child was given. Named on the panel because a character
  // nobody can see the name of is not a character.
  const character = usePersona();
  const canWrite = koda.access("chat").offered;
  const canTalk = koda.access("voice").offered;

  /** A turn, plus whether Koda actually said it — see `KodaReply.degraded`. */
  const [turns, setTurns] = useState<(KodaTurn & { standIn?: boolean })[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  /**
   * What this conversation is recording.
   *
   * Opened on the first question rather than on mount: a panel opened and shut
   * without a word is not a conversation, and should not become a row.
   */
  const conversationRef = useRef<KodaConversation | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
    // Closing the panel ends the conversation, which is when it is written.
    if (!isOpen) {
      conversationRef.current?.end();
      conversationRef.current = null;
    }
  }, [isOpen]);

  // And when the panel goes away entirely, mid-sentence or not.
  useEffect(
    () => () => {
      conversationRef.current?.end();
      conversationRef.current = null;
    },
    [],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, thinking]);

  if (!isOpen) return null;

  const send = async (question: string) => {
    if (!question.trim() || thinking) return;
    playSound("pop");
    conversationRef.current ??= new KodaConversation({
      mode: "chat",
      personaId: currentPersonaId(),
      conceptKey: context?.topic,
    });
    // The child's own words. Koda's replies are deliberately not recorded.
    conversationRef.current.said(question);
    const asked = [...turns, { sender: "student" as const, text: question.trim() }];
    setTurns(asked);
    setDraft("");
    setFailure(null);
    setThinking(true);

    const reply = await askKodaInWriting({
      question: question.trim(),
      context,
      history: asked,
    });
    setThinking(false);

    if (reply.text) {
      setTurns([...asked, { sender: "koda", text: reply.text, standIn: reply.degraded }]);
      return;
    }
    // Said plainly rather than as a bubble from Koda: a child should never be
    // shown an apology in the coach's own voice for something the coach did not
    // do. See `askKodaInWriting` for what each of these means.
    setFailure(
      reply.error === "plan"
        ? "Koda's written help is part of a paid plan. Ask whoever runs your Koda."
        : reply.error === "off"
          ? "Written help is switched off on this Koda right now."
          : "Koda could not be reached. Try again in a moment.",
    );
  };

  /** Openers, so a blank panel is not a blank page. Rotated, never random. */
  const starters = [
    "I'm stuck — can you give me a hint?",
    "Can you explain this a different way?",
    "How do I get started?",
  ];

  return (
    <UIModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${character.emoji} Ask ${character.name}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* The way back. Kept at the top because talking is what a tap opens
            everywhere else — a child who came here to type should still be one
            control away from the thing they started with. */}
        {canTalk && canWrite && (
          <button
            onClick={() => {
              playSound("pop");
              onClose();
              onStartVoice();
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-left transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
              <Mic className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-sm font-bold text-ink">
                Talk to {character.name}
              </span>
              <span className="block text-xs text-muted">
                Say it out loud and Koda answers in a real voice.
              </span>
            </span>
          </button>
        )}

        {canWrite ? (
          <>
            <div
              className="max-h-[45vh] min-h-[12rem] space-y-3 overflow-y-auto rounded-2xl border border-line bg-surface-muted p-4"
              aria-live="polite"
            >
              {turns.length === 0 && !thinking && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <SvgAsset id="koda-ask" size={28} fallback={<Sparkles className="h-5 w-5" />} />
                    <p>
                      I'm {character.name}. Ask me anything about what you're working on.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {starters.map((starter) => (
                      <button
                        key={starter}
                        onClick={() => void send(starter)}
                        className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink transition-colors hover:border-indigo-400"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {turns.map((turn, index) => (
                <div
                  key={`${index}-${turn.sender}`}
                  className={turn.sender === "student" ? "flex justify-end" : "flex justify-start"}
                >
                  <div className="max-w-[85%] space-y-1">
                    <p
                      className={[
                        "whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm",
                        turn.sender === "student"
                          ? "bg-indigo-600 text-white"
                          : turn.standIn
                            ? "border border-dashed border-amber-400 bg-amber-50 text-ink dark:bg-amber-950/30"
                            : "border border-line bg-surface text-ink",
                      ].join(" ")}
                    >
                      {turn.text}
                    </p>
                    {/* Not Koda, and said so. An operator seeing this knows to
                        check the key and the model id on the Ask Koda page;
                        without it, a deployment answering with canned nudges
                        looks like a coach that has simply gone vague. */}
                    {turn.standIn && (
                      <p className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Koda could not be reached — this is a general nudge, not an answer.
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {thinking && (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500"
                        style={{ animationDelay: `${dot * 120}ms` }}
                      />
                    ))}
                  </span>
                  Koda is thinking…
                </p>
              )}
              <div ref={endRef} />
            </div>

            {failure && <p className={themeSystem.flash("warning")}>{failure}</p>}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(draft);
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type your question…"
                aria-label="Your question for Koda"
                maxLength={500}
                className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!draft.trim() || thinking}
                aria-label="Send"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          /* Written help switched off while this panel was open — a tap opens
             the voice coach directly in that case, so this is a safety net
             rather than a route. It says what Koda can still do here instead of
             showing an input the server would refuse. */
          <div className="space-y-4 py-2 text-center">
            <SvgAsset
              id="koda-ask"
              size={56}
              fallback={<Sparkles className="mx-auto h-10 w-10 text-indigo-500" />}
            />
            <p className="text-sm text-muted">
              {character.name} listens and answers out loud here. Written help is switched off.
            </p>
            <UIButton
              variant="primary"
              icon={<Mic />}
              onClick={() => {
                playSound("pop");
                onClose();
                onStartVoice();
              }}
            >
              Talk to {character.name}
            </UIButton>
          </div>
        )}
      </div>
    </UIModal>
  );
};
