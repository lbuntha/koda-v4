import React, { useEffect, useRef, useState } from "react";
import { questionsApi } from "../api/questions";
import { useAuth } from "../auth/AuthContext";
import { mayPersistRemotely } from "../api/persistenceGuard";
import type { CountingQuestion } from "../types";
import { deduplicateQuestions } from "../components/curriculum/questionOps";

const LEGACY_KEY = "counting_studio_questions";
const MIGRATION_OWNER_KEY = "koda_question_migration_owner";

export type QuestionPersistenceStatus = "local" | "loading" | "saving" | "saved" | "error";

function readQuestions(key: string): CountingQuestion[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? deduplicateQuestions(value) : [];
  } catch {
    return [];
  }
}

function writeQuestions(key: string, questions: CountingQuestion[]): void {
  try {
    const clean = deduplicateQuestions(questions);
    localStorage.setItem(key, JSON.stringify(clean));
  } catch {
    // MongoDB remains authoritative when browser storage is unavailable.
  }
}

export function useQuestionDeck(defaultQuestions: CountingQuestion[]) {
  const { status, account } = useAuth();
  const [questions, setQuestionsState] = useState<CountingQuestion[]>(() => {
    const legacy = readQuestions(LEGACY_KEY);
    const initial = legacy.length > 0 ? legacy : defaultQuestions;
    return deduplicateQuestions(initial);
  });

  const setQuestions = (action: CountingQuestion[] | ((prev: CountingQuestion[]) => CountingQuestion[])) => {
    setQuestionsState(prev => {
      const next = typeof action === "function" ? action(prev) : action;
      return deduplicateQuestions(next);
    });
  };

  const persistenceStatusState = useState<QuestionPersistenceStatus>("local");
  const [persistenceStatus, setPersistenceStatus] = persistenceStatusState;

  // Why the last save failed. Without it the UI could only guess, and it guessed wrong: a 400
  // from the server ("questions reference missing curriculum skills") was reported to the
  // author as "MongoDB unavailable", sending them to look at the database instead of the
  // curriculum. The status says something is wrong; this says what.
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  /** See the save effect: a load that failed must never be allowed to write. */
  const hydrationFailedRef = useRef(false);
  const remoteRevisionRef = useRef(0);
  const changeRevisionRef = useRef(0);
  const queueRef = useRef<Promise<{ ok: true; revision: number } | undefined>>(Promise.resolve(undefined));

  useEffect(() => {
    if (status !== "authenticated" || !account || account.role === "student") return;
    const ownerId = account.id;
    const cacheKey = `${LEGACY_KEY}:${ownerId}`;
    let cancelled = false;
    hydratedRef.current = false;
    hydrationFailedRef.current = false;
    setPersistenceStatus("loading");

    void (async () => {
      try {
        const remote = await questionsApi.get();
        if (cancelled) return;
        remoteRevisionRef.current = remote.revision;
        const accountCache = readQuestions(cacheKey);
        const legacy = readQuestions(LEGACY_KEY);
        const local = accountCache.length > 0 ? accountCache : legacy;
        let next = deduplicateQuestions(remote.questions);

        if (!remote.exists || (remote.questions.length === 0 && local.length > 0)) {
          next = deduplicateQuestions(local.length > 0 ? local : defaultQuestions);
          const saved = await questionsApi.put(next, remote.revision);
          remoteRevisionRef.current = saved.revision;
          if (local.length > 0) {
            localStorage.setItem(MIGRATION_OWNER_KEY, ownerId);
            localStorage.removeItem(LEGACY_KEY);
          }
        }

        if (cancelled) return;
        if (next.length === 0) next = deduplicateQuestions(defaultQuestions);
        setQuestionsState(next);
        writeQuestions(cacheKey, next);
        hydratedRef.current = true;
        setPersistenceStatus("saved");
      } catch {
        if (cancelled) return;
        // Show the cache so the studio still opens, but nothing here is authoritative: when
        // the cache is empty `questions` keeps the starter deck, which is emphatically not
        // this account's bank. Saving is blocked below until a load succeeds.
        const cached = readQuestions(cacheKey);
        if (cached.length > 0) setQuestionsState(deduplicateQuestions(cached));
        hydratedRef.current = true;
        hydrationFailedRef.current = true;
        setPersistenceStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [status, account?.id, account?.role, defaultQuestions]);

  useEffect(() => {
    if (status === "offline") {
      writeQuestions(LEGACY_KEY, questions);
      return;
    }
    if (status !== "authenticated" || !account || account.role === "student" || !hydratedRef.current) return;

    const cacheKey = `${LEGACY_KEY}:${account.id}`;
    writeQuestions(cacheKey, questions);

    // `remoteRevisionRef` outlives a single load, so after one good load it still holds a
    // revision the server accepts. Without this guard a later failed load would push the
    // cache — or the starter deck — over the account's whole question bank and report
    // "Saved". Reading has to succeed before writing is allowed.
    if (!mayPersistRemotely({
      hydrated: hydratedRef.current, hydrationFailed: hydrationFailedRef.current,
    })) {
      setPersistenceStatus("error");
      setPersistenceError("Couldn't load your worksheets, so saving is paused. Reload to try again.");
      return;
    }
    const changeRevision = ++changeRevisionRef.current;
    setPersistenceStatus("saving");
    const timeout = window.setTimeout(() => {
      const save = () => questionsApi.put(questions, remoteRevisionRef.current);
      // Swallows only the *previous* save's rejection, so one failure doesn't poison the
      // queue for every later save. This save's own outcome is handled below.
      queueRef.current = queueRef.current.catch(() => undefined).then(save);
      void queueRef.current.then(
        (result) => {
          if (!result) return;
          remoteRevisionRef.current = result.revision;
          if (changeRevisionRef.current === changeRevision) {
            setPersistenceStatus("saved");
            setPersistenceError(null);
          }
        },
        (cause) => {
          if (changeRevisionRef.current !== changeRevision) return;
          setPersistenceStatus("error");
          setPersistenceError(cause instanceof Error ? cause.message : "Saving failed.");
        }
      );
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [questions, status, account?.id, account?.role]);

  return { questions, setQuestions, persistenceStatus, persistenceError };
}
