import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Eye, Pause, Play, Volume2 } from "lucide-react";

import { themeSystem } from "../../lib/themeSystem";
import { speakWebSpeech } from "../../utils/audio";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UISectionHeader } from "../ui";
import { KodaMascot, type MascotState } from "../KodaMascot";
import type { Character } from "./KodaCharacters";

import { translate } from "../../lib/i18n";
/**
 * What a character looks and sounds like, without a child having to meet them.
 *
 * An operator writing a teaching manner has no way to judge it: the manner is a
 * paragraph in a form, and everything downstream of it — the bobbing, the
 * listening rings, the voice — only appears once a real child opens a real
 * session against a real key. So a character gets reviewed by being deployed,
 * which is the wrong order.
 *
 * This runs the whole surface locally. **Nothing here calls the model**, and
 * that is the point rather than a limitation: the states are the states the app
 * actually has, driven by hand, so an operator can watch Coach Rio listen and
 * Ms Vega think side by side in ten seconds. What it cannot show is what the
 * model will *say* — see the note the panel prints, which is honest about that
 * rather than fabricating a reply and letting somebody believe it.
 */

/** The five, in the order a real conversation moves through them. */
const STATES: { state: MascotState; label: string; caption: string }[] = [
  { state: "idle", get label() { return translate("admin.characterPreview.waiting"); }, get caption() { return translate("admin.characterPreview.isHereWaitingForYou"); } },
  { state: "listening", get label() { return translate("admin.characterPreview.listening"); }, get caption() { return translate("admin.characterPreview.isListeningTheMicrophoneIsOpen"); } },
  { state: "thinking", get label() { return translate("admin.characterPreview.thinking"); }, get caption() { return translate("admin.characterPreview.isWorkingOutHowToHelp"); } },
  { state: "speaking", get label() { return translate("admin.characterPreview.speaking"); }, get caption() { return translate("admin.characterPreview.isAnsweringOutLoud"); } },
  { state: "celebrating", get label() { return translate("admin.characterPreview.celebrating"); }, get caption() { return translate("admin.characterPreview.sawYouGetIt"); } },
];

/**
 * What a character says when you press Hear it.
 *
 * Written per state, and deliberately generic: the point is to hear the *voice*
 * and the pacing, not to preview an answer. A sample that read like real
 * tutoring would be a promise about output nothing here can keep.
 */
const SAMPLE: Record<MascotState, string> = {
  idle: "Hello! I'm here whenever you're ready.",
  listening: "Go ahead, I'm listening.",
  thinking: "Let me think about that for a second.",
  speaking: "Look at the tens first. How many groups of ten can you see?",
  celebrating: "You got it! That was good thinking.",
};

export const CharacterPreview: React.FC<{ roster: Character[] }> = ({ roster }) => {
  const [activeId, setActiveId] = useState<string>(roster[0]?.personaId ?? "koda");
  const [state, setState] = useState<MascotState>("idle");
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  const character = roster.find((row) => row.personaId === activeId) ?? roster[0];

  // Keep the selection valid when the roster changes underneath — a character
  // deleted in the editor above should not leave this panel on a ghost.
  useEffect(() => {
    if (roster.length && !roster.some((row) => row.personaId === activeId)) {
      setActiveId(roster[0].personaId);
    }
  }, [roster, activeId]);

  /*
   * The sequence: every state in order, on a loop.
   *
   * Held in a ref rather than an effect over `state`, so pressing a state by
   * hand mid-sequence does not fight the timer — stopping is explicit.
   */
  useEffect(() => {
    if (!playing) return;
    let index = STATES.findIndex((entry) => entry.state === state);
    timer.current = window.setInterval(() => {
      index = (index + 1) % STATES.length;
      setState(STATES[index].state);
    }, 2600);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };
    // `state` is deliberately absent: including it would restart the interval on
    // every tick, and the sequence would never advance past the first step.
  }, [playing]);

  if (!character) return null;

  const current = STATES.find((entry) => entry.state === state) ?? STATES[0];

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title={translate("admin.characterPreview.seeThemInAction")}
        subtitle={translate("admin.characterPreview.howEachTeacherLooksWhileThey")}
        icon={<Eye className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      {/* Which teacher. A row of names rather than a dropdown: comparing two is
          the job, and a dropdown hides the thing being compared. */}
      {roster.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={translate("admin.characterPreview.characterToPreview")}>
          {roster.map((row) => (
            <button
              key={row.personaId}
              role="tab"
              aria-selected={row.personaId === activeId}
              onClick={() => {
                playSound("pop");
                setActiveId(row.personaId);
              }}
              className={[
                "flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-mono font-bold transition-colors",
                row.personaId === activeId
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                  : "border-line text-muted hover:border-indigo-300",
              ].join(" ")}
            >
              <span aria-hidden>{row.emoji}</span>
              {row.name}
              {!row.enabled && <UIBadge variant="neutral">{translate("admin.characterPreview.retired")}</UIBadge>}
            </button>
          ))}
        </div>
      )}

      {/* The stage. Fixed height so switching state does not resize the card and
          shove the controls under the pointer that is using them. */}
      <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-muted">
        <AnimatePresence mode="wait">
          <motion.div
            key={character.personaId}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <KodaMascot
              state={state}
              personaId={character.personaId}
              avatarSeed={character.avatarSeed}
              size={200}
            />
          </motion.div>
        </AnimatePresence>

        <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-muted">
          <strong className="text-ink">{character.name}</strong> {current.caption}
        </p>
      </div>

      {/* The states, as buttons. Pressing one stops the sequence, because a
          control that fights an animation is a control nobody trusts. */}
      <div className="flex flex-wrap items-center gap-2">
        {STATES.map((entry) => (
          <button
            key={entry.state}
            aria-pressed={entry.state === state}
            onClick={() => {
              setPlaying(false);
              setState(entry.state);
            }}
            className={[
              "rounded-full px-3 py-1.5 text-xs font-mono font-bold transition-colors",
              entry.state === state
                ? "bg-indigo-600 text-white"
                : "bg-surface-muted text-muted hover:text-ink",
            ].join(" ")}
          >
            {entry.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <UIButton
            variant="secondary"
            size="sm"
            icon={playing ? <Pause /> : <Play />}
            onClick={() => setPlaying((on) => !on)}
          >
            {playing ? translate("admin.characterPreview.stop") : translate("admin.characterPreview.playAll")}
          </UIButton>
          <UIButton
            variant="secondary"
            size="sm"
            icon={<Volume2 />}
            onClick={() => speakWebSpeech(SAMPLE[state])}
          >
            {translate("admin.characterPreview.hearIt")}
          </UIButton>
        </div>
      </div>

      {/*
        * What this preview is and is not.
        *
        * Said plainly because the gap matters: the movement is exactly what a
        * child sees, and the voice is not — Gemini's voices only exist in a live
        * session. An operator who thought they had heard {character.name} and
        * then heard something else in production would rightly distrust the
        * whole screen.
        */}
      <p className="text-xs text-muted">
        {translate("admin.characterPreview.theMovementIsWhatAChild")}{" "}<strong className="text-ink">{translate("admin.characterPreview.hearIt")}</strong>{" "}{translate("admin.characterPreview.usesThisDeviceSOwnVoice")}{" "}{character.voice}{" "}{translate("admin.characterPreview.kodaSRealVoicesOnlyExist")}
      </p>
    </section>
  );
};
