/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persists a local history for instant teacher feedback and, during an
 * authenticated student curriculum session, mirrors events through a durable
 * outbox to MongoDB. Consumers never write storage or call the API directly.
 */

import {
  LearningEvent,
  LearningEventType,
  AttemptOutcome,
  SkillMasterySnapshot,
  CURRENT_SCHEMA_VERSION,
  computeSkillMastery,
  localIsoTimestamp,
} from "./logSchema";
import { learningApi } from "../api/learning";

const STORAGE_KEY = "koda_learning_events_v1";
const SESSION_KEY = "koda_session_id_v1";
const MAX_LOG_HISTORY = 1000;
const OUTBOX_PREFIX = "koda_learning_event_outbox_v1";
/** `keepalive` requests share a 64KB browser budget; stay well under it. */
const HIDE_FLUSH_BYTE_BUDGET = 50_000;

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
  private serverSyncStudentId: string | null = null;
  private outbox: LearningEvent[] = [];
  private syncTimer: number | null = null;
  private flushPromise: Promise<void> | null = null;

  public setCurrentStudent(studentId: string | null) {
    this.currentStudentId = studentId;
  }

  public setSessionId(sessionId: string) {
    this.sessionId = sessionId;
    try { sessionStorage.setItem(SESSION_KEY, sessionId); } catch { /* memory value is sufficient */ }
  }

  public enableServerSync(studentId: string) {
    this.currentStudentId = studentId;
    this.serverSyncStudentId = studentId;
    try {
      const parsed = JSON.parse(localStorage.getItem(`${OUTBOX_PREFIX}:${studentId}`) || "[]");
      this.outbox = Array.isArray(parsed) ? parsed : [];
    } catch { this.outbox = []; }
    void this.flush();
  }

  public disableServerSync() {
    this.serverSyncStudentId = null;
    this.currentStudentId = null;
    if (this.syncTimer !== null) window.clearTimeout(this.syncTimer);
    this.syncTimer = null;
  }

  private saveOutbox() {
    if (!this.serverSyncStudentId) return;
    try { localStorage.setItem(`${OUTBOX_PREFIX}:${this.serverSyncStudentId}`, JSON.stringify(this.outbox)); } catch { /* retry remains in memory */ }
  }

  private scheduleFlush() {
    if (!this.serverSyncStudentId || this.syncTimer !== null) return;
    this.syncTimer = window.setTimeout(() => {
      this.syncTimer = null;
      void this.flush();
    }, 800);
  }

  private async runFlush(): Promise<void> {
    try {
      while (this.outbox.length > 0 && this.serverSyncStudentId) {
        const batch = this.outbox.slice(0, 50);
        await learningApi.ingestEvents(batch);
        const sentIds = new Set(batch.map(event => event.id));
        this.outbox = this.outbox.filter(event => !sentIds.has(event.id));
        this.saveOutbox();
      }
    } catch {
      this.saveOutbox();
    }
  }

  public flush(): Promise<void> {
    if (!this.serverSyncStudentId || this.outbox.length === 0) {
      return this.flushPromise ?? Promise.resolve();
    }
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.runFlush().finally(() => {
      this.flushPromise = null;
      if (this.outbox.length > 0) this.scheduleFlush();
    });
    return this.flushPromise;
  }

  /**
   * Wait for the outbox to drain, but never longer than `ms`.
   *
   * A screen a child is waiting on cannot be hostage to a stalled phone network: `fetch` has
   * no timeout of its own and a flaky mobile connection can hang for a minute. Giving up on the
   * *wait* costs nothing — the outbox is on disk and the same events retry on the next open, so
   * the choice is only between "the child stares at a spinner" and "the child moves on".
   *
   * Resolves `true` when everything reached the server, `false` when the wait ran out.
   */
  public async flushWithin(ms: number): Promise<boolean> {
    let timer: number | undefined;
    const expired = new Promise<false>(resolve => {
      timer = window.setTimeout(() => resolve(false), ms);
    });
    try {
      return await Promise.race([this.flush().then(() => this.outbox.length === 0), expired]);
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
    }
  }

  /** Events still waiting to reach the server — the "did it save?" question, answered locally. */
  public pendingCount(): number {
    return this.outbox.length;
  }

  /**
   * Send what is queued while the page is being backgrounded or closed.
   *
   * This is the mobile case: a child taps Home, the screen locks, or the browser is swapped
   * out, and iOS/Android freeze the tab — `beforeunload` never fires there, and an in-flight
   * ordinary fetch is dropped. `pagehide` and the hidden transition are the only reliable
   * signals, and `keepalive` is the only send that outlives the page.
   */
  private flushOnHide() {
    if (!this.serverSyncStudentId || this.outbox.length === 0) return;
    const batch: LearningEvent[] = [];
    let bytes = 0;
    for (const event of this.outbox) {
      const size = JSON.stringify(event).length;
      if (batch.length > 0 && bytes + size > HIDE_FLUSH_BYTE_BUDGET) break;
      batch.push(event);
      bytes += size;
    }
    // Entries stay in the outbox until the send is confirmed. If the page dies first the
    // browser may still deliver it, and the retry on next open is deduplicated server-side.
    void learningApi.ingestEventsOnHide(batch)
      .then(() => {
        const sentIds = new Set(batch.map(event => event.id));
        this.outbox = this.outbox.filter(event => !sentIds.has(event.id));
        this.saveOutbox();
      })
      .catch(() => { /* retried on the next open from the persisted outbox */ });
  }
  /** slideIndex -> ms timestamp the slide was opened, for timeOnTaskMs. */
  private slideOpenedAt = new Map<number, number>();
  /** slideIndex -> attempt count so far this visit, resets on slide_view. */
  private attemptCounts = new Map<number, number>();
  private hintShownSinceView = new Set<number>();

  constructor() {
    this.loadFromStorage();
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => void this.flush());
      // Both signals, on purpose: `pagehide` covers navigation away and tab close, the hidden
      // transition covers app switching and screen lock, which is how phones actually leave.
      window.addEventListener("pagehide", () => this.flushOnHide());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.flushOnHide();
        else void this.flush(); // back in the foreground: retry whatever the exit could not send
      });
    }
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
      occurredAt: localIsoTimestamp(now),
      clientTimestampMs: now.getTime(),
      ...partial,
    };
    this.events = [event, ...this.events].slice(0, MAX_LOG_HISTORY);
    if (this.serverSyncStudentId) {
      this.outbox.push(event);
      this.saveOutbox();
      this.scheduleFlush();
    }
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

  public logHintRequested(ctx: SlideContext, details?: Record<string, any>) {
    this.hintShownSinceView.add(ctx.slideIndex);
    return this.record({
      ...this.baseFields(ctx),
      eventType: "hint_requested",
      actionSummary: `Hint shown on Slide ${ctx.slideIndex + 1}: ${ctx.questionTitle}`,
      details: { ...ctx.details, ...details },
    });
  }

  /**
   * The event the old schema couldn't represent: a single right/wrong/partial
   * attempt, with attempt number, hint context, and diagnostic before/after
   * values — everything computeSkillMastery() needs.
   */
  public logAttempt(
    ctx: SlideContext,
    outcome: AttemptOutcome,
    detail?: { expected?: unknown; selected?: unknown; details?: Record<string, any> },
  ) {
    const nextAttempt = (this.attemptCounts.get(ctx.slideIndex) || 0) + 1;
    this.attemptCounts.set(ctx.slideIndex, nextAttempt);
    const openedAt = this.slideOpenedAt.get(ctx.slideIndex);

    const errorMagnitude = (() => {
      if (detail?.expected == null || detail?.selected == null) return undefined;
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
      details: { ...ctx.details, ...detail?.details },
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

  public logLessonComplete(ctx: {
    slideIndex: number;
    totalSlides: number;
    curriculumId?: string;
    curriculumRevision?: number;
    releaseId?: string;
    assignmentId?: string;
    recommendationRunId?: string;
    curriculumSkillId?: string;
  }) {
    return this.record({
      questionId: "",
      technique: undefined as any,
      subjectArea: "counting",
      skillTags: [],
      slideIndex: ctx.slideIndex,
      totalSlides: ctx.totalSlides,
      curriculumId: ctx.curriculumId,
      curriculumRevision: ctx.curriculumRevision,
      releaseId: ctx.releaseId,
      assignmentId: ctx.assignmentId,
      recommendationRunId: ctx.recommendationRunId,
      curriculumSkillId: ctx.curriculumSkillId,
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
  curriculumId?: string;
  curriculumRevision?: number;
  releaseId?: string;
  assignmentId?: string;
  recommendationRunId?: string;
  difficulty?: "easy" | "medium" | "hard";
  details?: Record<string, any>;
  slideIndex: number;
  totalSlides: number;
  questionTitle: string;
}

export const analyticsLogger = new AnalyticsLoggerService();
export type { LearningEvent, LearningEventType, AttemptOutcome, SkillMasterySnapshot };
