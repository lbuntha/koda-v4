/**
 * Rebus Rush, as a page inside Learn → Think.
 *
 * Setup, then a round: the puzzle, its reveal, and a summary. All of it plays
 * on the device from the bank it is given, so a child with no connection plays
 * the same game. `onDeepChange` tells Learn when a round is in progress, so it
 * can hide its switcher the way Library does inside a book.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../lib/i18n";
import { themeSystem } from "../lib/themeSystem";
import { useAudienceViewer } from "../skills/viewer";
import { bankForAge, useRebusBank } from "./bank";
import { buildRound, filterPuzzles } from "./round";
import { loadAdaptive, saveAdaptive } from "./prefs";
import { loadResults, saveOutcome } from "./resultsStore";
import { loadSeen, markSeen } from "./seenStore";
import type { RebusSettings } from "./settings";
import { useRebusSettings } from "./settingsStore";
import { GroupHome } from "./group/GroupHome";
import { TurnsHome } from "./turns/TurnsHome";
import { useSession } from "../lib/sync";
import { seenSet } from "./seen";
import { RebusEmpty } from "./ui/RebusEmpty";
import { PlayView, RevealView } from "./ui/RebusPlay";
import { RebusSetup, type RebusChoice } from "./ui/RebusSetup";
import { RebusSummary } from "./ui/RebusSummary";
import { useRebusRound } from "./ui/useRebusRound";
import { useRebusLearning } from "./ui/useRebusLearning";
import { useRebusSounds } from "./ui/useRebusSounds";

export interface RebusPageProps {
  /** Overrides the learner's age, for a preview. Otherwise the signed-in learner's age is used. */
  age?: number | null;
  /** Overrides the owner's settings, for a preview or a test. Otherwise the operator's own are used. */
  settings?: RebusSettings;
  /** True while a round is being played, so Learn can step aside. */
  onDeepChange?(deep: boolean): void;
  /** A finished round pays XP, once. */
  onAwardXp?(xp: number): void;
  /** Back out of Rebus Rush to the Think shelf. */
  onExit?(): void;
  /** A room code from an invitation link: opens group play at the join screen. */
  joinCode?: string | null;
  /** The invitation code has been used (or the player backed out of it). */
  onJoinCodeUsed?(): void;
}

export const RebusPage: React.FC<RebusPageProps> = ({ age: ageOverride, settings: settingsProp, onDeepChange, onAwardXp, onExit, joinCode = null, onJoinCodeUsed }) => {
  const { t } = useT();
  const ownerSettings = useRebusSettings();
  const settings = settingsProp ?? ownerSettings;
  const viewer = useAudienceViewer();
  const age = ageOverride === undefined ? viewer.age : ageOverride;
  const fullBank = useRebusBank();
  // The setup screen counts what this child can actually be given, so a topic they have no puzzles for is "Soon", not a dead end.
  const bank = useMemo(() => bankForAge(fullBank, age), [fullBank, age]);
  const round = useRebusRound();
  const [choice, setChoice] = useState<RebusChoice | null>(null);
  const [short, setShort] = useState(false);
  // Play all: what has been played in this pass, and what the last round left over.
  const [passDone, setPassDone] = useState<ReadonlySet<string>>(new Set());
  const [pass, setPass] = useState<{ total: number; remaining: number } | null>(null);
  // Results are read when setup opens and when a round ends, so the filter counts are current.
  const [results, setResults] = useState(loadResults);
  const recorded = useRef("");
  // A round of puzzles the child has all played before is practice: no XP.
  const [replay, setReplay] = useState(false);
  const phase = round.state?.phase;
  const session = useSession();
  // Playing with friends: its own screens, opened from setup or from an invitation link.
  const [group, setGroup] = useState(joinCode !== null);
  // Taking turns on this device: its own screens, no network.
  const [turns, setTurns] = useState(false);

  useEffect(() => {
    onDeepChange?.(phase !== undefined || group || turns);
    return () => onDeepChange?.(false);
  }, [phase, group, turns, onDeepChange]);

  useRebusSounds(round);
  // The ages the round covers, so the log files it under the right band.
  const roundAges = useMemo((): [number, number] | null => {
    const puzzles = round.state?.config.puzzles;
    if (!puzzles?.length) return null;
    return [Math.min(...puzzles.map((p) => p.ages[0])), Math.max(...puzzles.map((p) => p.ages[1]))];
  }, [round.state?.config.puzzles]);
  const earned = useRebusLearning(round, { category: choice?.category ?? null, ages: roundAges, replay, onAwardXp });

  // Remember how each puzzle went the moment it is revealed, once.
  const outcomes = round.state?.outcomes;
  useEffect(() => {
    const state = round.state;
    if (!state || state.outcomes.length === 0) return;
    const key = `${state.config.seed}:${state.outcomes.length}`;
    if (recorded.current === key) return;
    recorded.current = key;
    saveOutcome(state.outcomes[state.outcomes.length - 1]);
    // "Adaptive" picks up next round where this one left it.
    if (state.config.level === "adaptive") saveAdaptive(state.adaptive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcomes?.length]);

  const start = (pick: RebusChoice, done: ReadonlySet<string> = new Set()) => {
    const latest = loadResults();
    const built = buildRound(fullBank.puzzles, { category: pick.category, count: pick.count, age, seen: seenSet(loadSeen()), seed: `${Date.now()}`, difficulty: pick.difficulty, status: pick.status, results: latest, all: pick.all, done });
    if (built.puzzles.length === 0) return setShort(true);
    setShort(false);
    setChoice(pick);
    setResults(latest);
    setReplay(built.puzzles.every((p) => latest[p.id] !== undefined));
    if (pick.all) {
      // A finished pass starts over, so only carry the ids forward if the set was not used up.
      const carried = built.puzzles.every((p) => done.has(p.id)) ? new Set<string>() : done;
      setPassDone(new Set([...carried, ...built.puzzles.map((p) => p.id)]));
      setPass({ total: built.total, remaining: built.remaining });
    } else {
      setPass(null);
    }
    markSeen(built.puzzles.map((p) => p.id));
    round.start({ puzzles: built.puzzles, settings, level: pick.level, adaptiveStart: loadAdaptive(), seed: `${Date.now()}` });
  };

  if (group) {
    return (
      <GroupHome
        userToken={session?.accessToken ?? null}
        settings={settings}
        counts={fullBank.counts}
        initialCode={joinCode}
        onAwardXp={onAwardXp}
        onExit={() => {
          setGroup(false);
          onJoinCodeUsed?.();
        }}
      />
    );
  }

  if (turns) return <TurnsHome puzzles={bank.puzzles} counts={bank.counts} settings={settings} onExit={() => setTurns(false)} />;

  if (!round.state && fullBank.puzzles.length === 0) return <RebusEmpty loaded={fullBank.loaded} onBack={onExit} />;

  if (!round.state) {
    return (
      <>
        <RebusSetup bank={bank} settings={settings} results={results} onStart={(pick) => start(pick)} onGroup={() => setGroup(true)} onTurns={() => setTurns(true)} onBack={onExit} />
        {short && <p role="alert" className={themeSystem.flash("info", "mx-auto mt-3 max-w-2xl")}>{t("rebus.noneFit")}</p>}
      </>
    );
  }

  if (round.state.phase === "done") {
    const retry = choice && pass ? filterPuzzles(fullBank.puzzles, { category: choice.category, age, difficulty: choice.difficulty, status: "retry", results: loadResults() }).length : 0;
    return (
      <RebusSummary
        score={round.state.score}
        earned={earned}
        replay={replay}
        pass={pass ? { ...pass, retry } : undefined}
        onAgain={() => choice && start(choice, pass ? passDone : new Set())}
        onReplayAll={() => choice && start(choice)}
        onRetry={() => choice && start({ ...choice, status: "retry" })}
        onChangeTopic={round.reset}
      />
    );
  }

  return round.state.phase === "revealed" ? <RevealView round={round} autoNext={choice?.autoNext ?? false} /> : <PlayView round={round} letterTiles={settings.letterTiles} />;
};
