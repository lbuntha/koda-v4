import React, { useEffect, useRef, useState } from "react";
import { questionsApi } from "../api/questions";
import { useAuth } from "../auth/AuthContext";
import type { CountingQuestion } from "../types";

const LEGACY_KEY = "counting_studio_questions";
const MIGRATION_OWNER_KEY = "koda_question_migration_owner";

export type QuestionPersistenceStatus = "local" | "loading" | "saving" | "saved" | "error";

function readQuestions(key: string): CountingQuestion[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeQuestions(key: string, questions: CountingQuestion[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(questions));
  } catch {
    // MongoDB remains authoritative when browser storage is unavailable.
  }
}

export function useQuestionDeck(defaultQuestions: CountingQuestion[]) {
  const { status, account } = useAuth();
  const [questions, setQuestions] = useState<CountingQuestion[]>(() => {
    const legacy = readQuestions(LEGACY_KEY);
    return legacy.length > 0 ? legacy : defaultQuestions;
  });
  const [persistenceStatus, setPersistenceStatus] = useState<QuestionPersistenceStatus>("local");
  const hydratedRef = useRef(false);
  const remoteRevisionRef = useRef(0);
  const changeRevisionRef = useRef(0);
  const queueRef = useRef<Promise<{ ok: true; revision: number } | undefined>>(Promise.resolve(undefined));

  useEffect(() => {
    if (status !== "authenticated" || !account || account.role === "student") return;
    const ownerId = account.id;
    const cacheKey = `${LEGACY_KEY}:${ownerId}`;
    let cancelled = false;
    hydratedRef.current = false;
    setPersistenceStatus("loading");

    void (async () => {
      try {
        const remote = await questionsApi.get();
        if (cancelled) return;
        remoteRevisionRef.current = remote.revision;
        const accountCache = readQuestions(cacheKey);
        const legacy = readQuestions(LEGACY_KEY);
        const local = accountCache.length > 0 ? accountCache : legacy;
        let next = remote.questions;

        if (!remote.exists || (remote.questions.length === 0 && local.length > 0)) {
          next = local.length > 0 ? local : defaultQuestions;
          const saved = await questionsApi.put(next, remote.revision);
          remoteRevisionRef.current = saved.revision;
          if (local.length > 0) {
            localStorage.setItem(MIGRATION_OWNER_KEY, ownerId);
            localStorage.removeItem(LEGACY_KEY);
          }
        }

        if (cancelled) return;
        if (next.length === 0) next = defaultQuestions;
        setQuestions(next);
        writeQuestions(cacheKey, next);
        hydratedRef.current = true;
        setPersistenceStatus("saved");
      } catch {
        if (cancelled) return;
        const cached = readQuestions(cacheKey);
        if (cached.length > 0) setQuestions(cached);
        hydratedRef.current = true;
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
    const changeRevision = ++changeRevisionRef.current;
    setPersistenceStatus("saving");
    const timeout = window.setTimeout(() => {
      const save = () => questionsApi.put(questions, remoteRevisionRef.current);
      queueRef.current = queueRef.current.catch(() => undefined).then(save);
      void queueRef.current.then(
        (result) => {
          if (!result) return;
          remoteRevisionRef.current = result.revision;
          if (changeRevisionRef.current === changeRevision) setPersistenceStatus("saved");
        },
        () => {
          if (changeRevisionRef.current === changeRevision) setPersistenceStatus("error");
        }
      );
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [questions, status, account?.id, account?.role]);

  return { questions, setQuestions, persistenceStatus };
}
