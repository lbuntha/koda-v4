/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persists `LearningEvent`s (services/logSchema.ts) to localStorage today.
 * The storage layer is the ONLY thing that should need to change to move to
 * a real backend — swap `loadFromStorage`/`saveToStorage`/`logEvent` for
 * fetch calls against your API; every consumer (GameLauncher,
 * AnalyticsViewerModal) talks to this service, never to localStorage directly.
 */

import {
  LearningEvent,
  LearningEventType,
  AttemptOutcome,
  SkillMasterySnapshot,
  CURRENT_SCHEMA_VERSION,
  computeSkillMastery,
} from "./logSchema";

const STORAGE_KEY = "koda_learning_events_v1";
const SESSION_KEY = "koda_session_id_v1";
const MAX_LOG_HISTORY = 1000;

type LogSubscriber = (events: LearningEvent[]) => void;

const genId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** One id per browser session (tab lifetime survives reload via sessionStorage). Stand-in for a real session/auth id. */
function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = genId("sess");
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return genId("sess");
  }
}

class AnalyticsLoggerService {
  private events: LearningEvent[] = [];
  private subscribers: Set<LogSubscriber> = new Set();
  private sessionId = getSessionId();
  /** Null until GameLauncher has a real "who is playing" picker — see the note at the bottom of curriculum/types.ts. Settable now so wiring that picker later is a one-line call, not a re-plumb. */
  private currentStudentId: string | null = null;

  public setCurrentStudent(studentId: string | null) {
    this.currentStudentId = studentId;
  }
  /** slideIndex -> ms timestamp the slide was opened, for timeOnTaskMs. */
  private slideOpenedAt = new Map<number, number>();
  /** slideIndex -> attempt count so far this visit, resets on slide_view. */
  private attemptCounts = new Map<number, number>();
  private hintShownSinceView = new Set<number>();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.events = parsed;
      }
    } catch (err) {
      console.warn("Failed to load learning events from localStorage:", err);
      this.events = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
    } catch (err) {
      console.warn("Failed to save learning events to localStorage:", err);
    }
  }

  private notifySubscribers() {
    this.subscribers.forEach((fn) => {
      try {
        fn(this.events);
      } catch (e) {
        console.error("Subscriber error:", e);
      }
    });
  }

  public subscribe(fn: LogSubscriber): () => void {
    this.subscribers.add(fn);
    fn(this.events);
    return () => this.subscribers.delete(fn);
  }

  /**
   * Core write path. Fills every DB-shaped field (id, schemaVersion,
   * timestamps, sessionId, and the nullable studentId placeholder) so callers
   * only ever supply the semantic content.
   */
  private record(partial: Omit<LearningEvent, "id" | "schemaVersion" | "sessionId" | "occurredAt" | "clientTimestampMs" | "studentId">): LearningEvent {
    const now = new Date();
    const event: LearningEvent = {
      id: genId("evt"),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sessionId: this.sessionId,
      studentId: this.currentStudentId, // null until a real "who is playing" picker calls setCurrentStudent()
      occurredAt: now.toISOString(),
      clientTimestampMs: now.getTime(),
      ...partial,
    };
    this.events = [event, ...this.events].slice(0, MAX_LOG_HISTORY);
    this.saveToStorage();
    this.notifySubscribers();
    return event;
  }

  /** Strips the UI-only `questionTitle` field a SlideContext carries before it hits the LearningEvent shape. */
  private baseFields(ctx: SlideContext) {
    const { questionTitle, ...rest } = ctx;
    return rest;
  }

  // ── High-level event helpers — what GameLauncher and canvases call ──────────

  public logSlideView(ctx: SlideContext) {
    this.slideOpenedAt.set(ctx.slideIndex, Date.now());
    this.attemptCounts.set(ctx.slideIndex, 0);
    this.hintShownSinceView.delete(ctx.slideIndex);
    return this.record({
      ...this.baseFields(ctx),
      eventType: "slide_view",
      actionSummary: `Opened Slide ${ctx.slideIndex + 1}: ${ctx.questionTitle}`,
    });
  }

  public logHintRequested(ctx: SlideContext) {
    this.hintShownSinceView.add(ctx.slideIndex);
    return this.record({
      ...this.baseFields(ctx),
      eventType: "hint_requested",
      actionSummary: `Hint shown on Slide ${ctx.slideIndex + 1}: ${ctx.questionTitle}`,
    });
  }

  /**
   * The event the old schema couldn't represent: a single right/wrong/partial
   * attempt, with attempt number, hint context, and diagnostic before/after
   * values — everything computeSkillMastery() needs.
   */
  public logAttempt(ctx: SlideContext, outcome: AttemptOutcome, detail?: { expected?: string; selected?: string }) {
    const nextAttempt = (this.attemptCounts.get(ctx.slideIndex) || 0) + 1;
    this.attemptCounts.set(ctx.slideIndex, nextAttempt);
    const openedAt = this.slideOpenedAt.get(ctx.slideIndex);

    const errorMagnitude = (() => {
      if (!detail?.expected || !detail?.selected) return undefined;
      const e = Number(detail.expected), s = Number(detail.selected);
      return Number.isFinite(e) && Number.isFinite(s) ? Math.abs(e - s) : undefined;
    })();

    return this.record({
      ...this.baseFields(ctx),
      eventType: "attempt",
      outcome,
      attemptNumber: nextAttempt,
      hintUsedBeforeAttempt: this.hintShownSinceView.has(ctx.slideIndex),
      timeOnTaskMs: openedAt ? Date.now() - openedAt : undefined,
      expected: detail?.expected,
      selected: detail?.selected,
      errorMagnitude,
      actionSummary: outcome === "correct"
        ? `Correct! Solved Slide ${ctx.slideIndex + 1}: ${ctx.questionTitle} (attempt ${nextAttempt})`
        : `${outcome === "incorrect" ? "Incorrect" : "Partial"} attempt on Slide ${ctx.slideIndex + 1}: ${ctx.questionTitle} (attempt ${nextAttempt})`,
    });
  }

  public logSlideReset(ctx: SlideContext) {
    this.attemptCounts.set(ctx.slideIndex, 0);
    this.slideOpenedAt.set(ctx.slideIndex, Date.now());
    return this.record({
      ...this.baseFields(ctx),
      eventType: "slide_reset",
      actionSummary: `Reset Slide ${ctx.slideIndex + 1}: ${ctx.questionTitle}`,
    });
  }

  public logLessonComplete(ctx: { slideIndex: number; totalSlides: number }) {
    return this.record({
      questionId: "",
      technique: undefined as any,
      subjectArea: "counting",
      skillTags: [],
      slideIndex: ctx.slideIndex,
      totalSlides: ctx.totalSlides,
      eventType: "lesson_complete",
      actionSummary: `Completed all ${ctx.totalSlides} interactive slides! 🎉`,
    });
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  public getEvents(): LearningEvent[] {
    return this.events;
  }

  public clearEvents(): void {
    this.events = [];
    this.attemptCounts.clear();
    this.slideOpenedAt.clear();
    this.hintShownSinceView.clear();
    this.saveToStorage();
    this.notifySubscribers();
  }

  public getSkillMastery(): SkillMasterySnapshot[] {
    return computeSkillMastery(this.events);
  }

  public getSummary() {
    const attempts = this.events.filter(e => e.eventType === "attempt");
    const correct = attempts.filter(e => e.outcome === "correct").length;
    const incorrect = attempts.filter(e => e.outcome === "incorrect").length;
    const resets = this.events.filter(e => e.eventType === "slide_reset").length;
    const hints = this.events.filter(e => e.eventType === "hint_requested").length;
    const visitedSlides = new Set(this.events.map(e => e.slideIndex));

    const slideCounts: Record<string, number> = {};
    this.events.forEach(e => {
      const key = `Slide ${e.slideIndex + 1} (${e.technique})`;
      slideCounts[key] = (slideCounts[key] || 0) + 1;
    });
    let mostActiveSlide = "None", maxCount = -1;
    Object.entries(slideCounts).forEach(([key, count]) => {
      if (count > maxCount) { maxCount = count; mostActiveSlide = key; }
    });

    return {
      totalEvents: this.events.length,
      totalAttempts: attempts.length,
      correctAnswers: correct,
      incorrectAnswers: incorrect,
      totalHints: hints,
      totalResets: resets,
      slidesVisited: visitedSlides.size,
      mostActiveSlide,
    };
  }

  // ── Export — already DB-row-shaped; a real backend just receives this array ──

  public exportJSON(): string {
    return JSON.stringify(this.events, null, 2);
  }

  public exportCSV(): string {
    const headers = ["ID", "OccurredAt", "SessionID", "SlideIndex", "QuestionID", "Technique", "SubjectArea", "SkillTags", "EventType", "Outcome", "AttemptNumber", "Expected", "Selected", "TimeOnTaskMs", "ActionSummary"];
    if (this.events.length === 0) return headers.join(",") + "\n";

    const rows = this.events.map(e => [
      e.id, e.occurredAt, e.sessionId, e.slideIndex + 1, e.questionId, e.technique,
      e.subjectArea, e.skillTags.join("|"), e.eventType, e.outcome || "",
      e.attemptNumber ?? "", e.expected ?? "", e.selected ?? "", e.timeOnTaskMs ?? "",
      e.actionSummary.replace(/"/g, '""'),
    ].map(v => `"${v}"`).join(","));

    return [headers.join(","), ...rows].join("\n");
  }
}

interface SlideContext {
  questionId: string;
  technique: LearningEvent["technique"];
  subjectArea: LearningEvent["subjectArea"];
  skillTags: LearningEvent["skillTags"];
  /** From question.skillId — present only for curated, curriculum-mapped questions. */
  curriculumSkillId?: string;
  slideIndex: number;
  totalSlides: number;
  questionTitle: string;
}

export const analyticsLogger = new AnalyticsLoggerService();
export type { LearningEvent, LearningEventType, AttemptOutcome, SkillMasterySnapshot };
