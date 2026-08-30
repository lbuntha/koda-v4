import {
  MAX_ASKED,
  MAX_ASKED_CHARS,
  type KodaConversationEvent,
  type LearningEvent,
} from "../learning/events";
import { LearningLog } from "../learning/learningLog";
import { currentLearnerId } from "../learnerProgress";

/**
 * What a child asked Koda, kept so it can be recommended on later.
 *
 * Its own module, and deliberately not part of `LessonTracker`. That tracker is
 * shaped around a lesson — an open question, supports taken against it, an
 * answer that closes it — and a conversation fits none of that: it can start on
 * the home page with no lesson open, run across a lesson boundary, or be the
 * only thing a child does all session. Bolting it onto the tracker would mean
 * inventing a fake question for every chat.
 *
 * It records into the same log, though, because that is where recommendations
 * are read from. Independent producer, shared destination.
 *
 * **One event per conversation, written when it ends.** Not one per turn: a
 * recommendation is about "she keeps asking about teen numbers", which is a
 * property of the whole exchange. Per-turn events would be thirty rows saying
 * nothing each, and would put a child's words on the wire thirty times.
 *
 * What is stored is bounded by design — see `KodaConversationEvent`. Koda's own
 * replies are never kept; only what the child asked.
 */

export type KodaMode = "chat" | "voice";

export interface ConversationStart {
  mode: KodaMode;
  /** Which character is answering. See the event's note on why this matters. */
  personaId?: string;
  /** The lesson the child was on, when there was one. */
  lessonId?: string;
  /** The concept it was about, so a recommendation can aggregate on it. */
  conceptKey?: string;
  skillId?: string;
  levelNumber?: number;
  /** Whether the child opened Koda straight after getting something wrong. */
  afterWrongAnswer?: boolean;
}

/** Trimmed, truncated, and dropped when there is nothing left of it. */
const tidy = (text: string): string => text.trim().replace(/\s+/g, " ").slice(0, MAX_ASKED_CHARS);

/**
 * One conversation, from opening Koda to closing it.
 *
 * Nothing is written until `end()`. A conversation that is never ended — the tab
 * closed mid-sentence — records nothing, which is the right trade: an event
 * saying "a conversation started and we have no idea what happened" is not worth
 * a child's words on disk.
 */
export class KodaConversation {
  private readonly startedAt = Date.now();
  private readonly asked: string[] = [];
  private turns = 0;
  private ended = false;

  constructor(private readonly start: ConversationStart) {}

  /**
   * The child said something.
   *
   * Counted always; kept only while there is room. The cap drops later
   * questions rather than earlier ones, because the opening question is
   * usually the one that names the misconception — a child who has been given
   * three hints is asking about the hints by the end.
   */
  said(text: string): void {
    if (this.ended) return;
    this.turns += 1;
    const line = tidy(text);
    if (line && this.asked.length < MAX_ASKED) this.asked.push(line);
  }

  /** Close the conversation and write it. Safe to call twice. */
  end(): void {
    if (this.ended) return;
    this.ended = true;
    // A conversation nobody spoke in is a panel that was opened and shut.
    if (this.turns === 0) return;

    const body: Omit<KodaConversationEvent, "id" | "ts" | "sessionId" | "seq" | "localDay"> = {
      type: "koda_conversation",
      learnerId: currentLearnerId(),
      mode: this.start.mode,
      personaId: this.start.personaId,
      lessonId: this.start.lessonId,
      conceptKey: this.start.conceptKey,
      skillId: this.start.skillId,
      levelNumber: this.start.levelNumber,
      turns: this.turns,
      durationMs: Date.now() - this.startedAt,
      asked: [...this.asked],
      afterWrongAnswer: this.start.afterWrongAnswer,
    } as KodaConversationEvent;

    try {
      LearningLog.record(withEnvelope(body));
    } catch {
      // A conversation is a record, not the product. Losing one must never
      // interrupt a child who is mid-question.
    }
  }
}

/** Sequence within this page's session, so two events in one millisecond sort. */
let seq = 0;
const sessionId = `kc_${Math.random().toString(36).slice(2, 10)}`;

/**
 * The fields every logged event carries, filled for a producer that is not the
 * lesson tracker.
 */
function withEnvelope(
  body: Omit<KodaConversationEvent, "id" | "ts" | "sessionId" | "seq" | "localDay">,
): LearningEvent {
  const now = new Date();
  const localDay = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
  return {
    ...body,
    id: `kc_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    ts: now.toISOString(),
    sessionId,
    seq: (seq += 1),
    localDay,
  } as LearningEvent;
}

/** Every conversation recorded, newest last. For a report, or a recommender. */
export const conversations = (): KodaConversationEvent[] =>
  LearningLog.all().filter((e): e is KodaConversationEvent => e.type === "koda_conversation");
