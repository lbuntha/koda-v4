import { useEffect, useRef, useState } from "react";
import { curriculumApi } from "../api/curriculum";
import type { CurriculumOwner } from "../api/curriculum";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CurriculumTree } from "./types";
import { EXAMPLE_TREE } from "./seedExample";

const LEGACY_KEY = "koda_curriculum_tree_v1";
export type CurriculumPersistenceStatus = "local" | "loading" | "saving" | "saved" | "error";

function readTree(key: string): CurriculumTree | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed && Array.isArray(parsed.grades) && Array.isArray(parsed.skills) ? parsed : null;
  } catch {
    return null;
  }
}

function writeTree(key: string, tree: CurriculumTree): void {
  try { localStorage.setItem(key, JSON.stringify(tree)); } catch { /* offline cache is best-effort */ }
}

export function useCurriculumTree(curriculumId?: string) {
  const { status, account } = useAuth();
  const [tree, setTree] = useState<CurriculumTree>(() => readTree(LEGACY_KEY) || EXAMPLE_TREE);
  const [published, setPublished] = useState(false);
  const [owner, setOwner] = useState<CurriculumOwner | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [persistenceStatus, setPersistenceStatus] = useState<CurriculumPersistenceStatus>(
    status === "authenticated" ? "loading" : "local",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const remoteRevisionRef = useRef(0);
  const changeRevisionRef = useRef(0);
  // Set just before a conflict reconcile adopts the server's tree, so the
  // resulting effect run caches it without saving it straight back.
  const suppressSaveRef = useRef(false);
  const queueRef = useRef<Promise<{ ok: true; revision: number; updatedAt: string } | undefined>>(Promise.resolve(undefined));

  useEffect(() => {
    if (status !== "authenticated" || !account || account.role === "student") return;
    const cacheKey = `${LEGACY_KEY}:${account.id}${curriculumId ? `:${curriculumId}` : ""}`;
    let cancelled = false;
    hydratedRef.current = false;
    setLoadError(null);
    setPersistenceStatus("loading");

    void (async () => {
      try {
        const remote = await curriculumApi.get(curriculumId);
        if (cancelled) return;
        remoteRevisionRef.current = remote.revision;
        setRevision(remote.revision);
        setOwner(remote.owner);
        setCreatedAt(remote.createdAt);
        setUpdatedAt(remote.updatedAt);
        let next = remote.tree;
        let nextPublished = remote.published;

        if (!remote.exists || !remote.tree) {
          if (curriculumId) {
            // A specific curriculum was requested but the server returned none
            // by that id — surface it instead of silently opening the example
            // tree as if it were this curriculum's content.
            setLoadError("This curriculum could not be found. It may have been deleted.");
            setPersistenceStatus("error");
            return;
          }
          // Legacy single-curriculum path, first run: seed from cache or example.
          const local = readTree(cacheKey) || readTree(LEGACY_KEY);
          next = local || EXAMPLE_TREE;
          nextPublished = false;
          const saved = await curriculumApi.put(next, remote.revision, nextPublished);
          if (cancelled) return;
          remoteRevisionRef.current = saved.revision;
          setRevision(saved.revision);
          setUpdatedAt(saved.updatedAt);
          if (local) localStorage.removeItem(LEGACY_KEY);
        }

        if (cancelled) return;
        setTree(next || EXAMPLE_TREE);
        setPublished(nextPublished);
        writeTree(cacheKey, next || EXAMPLE_TREE);
        hydratedRef.current = true;
        setPersistenceStatus("saved");
      } catch (error) {
        if (cancelled) return;
        if (curriculumId) {
          // Failed to load a specific curriculum: show an error rather than
          // falling back to the example tree, and leave autosave disabled
          // (hydratedRef stays false) so we never overwrite an id we couldn't read.
          setLoadError(
            error instanceof ApiError && error.status === 404
              ? "This curriculum could not be found. It may have been deleted."
              : "Couldn't load this curriculum. Check your connection and try again.",
          );
          setPersistenceStatus("error");
          return;
        }
        const cached = readTree(cacheKey);
        if (cached) setTree(cached);
        hydratedRef.current = true;
        setPersistenceStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [status, account?.id, account?.role, curriculumId]);

  useEffect(() => {
    if (status === "offline") {
      writeTree(LEGACY_KEY, tree);
      return;
    }
    if (status !== "authenticated" || !account || account.role === "student" || !hydratedRef.current) return;
    const cacheKey = `${LEGACY_KEY}:${account.id}${curriculumId ? `:${curriculumId}` : ""}`;
    writeTree(cacheKey, tree);
    if (suppressSaveRef.current) {
      // This tree was adopted from the server by a conflict reconcile, not
      // edited by the user — cache it, but don't save it back and re-bump the
      // revision (which would spawn a no-op audit entry and could ping-pong).
      suppressSaveRef.current = false;
      return;
    }
    const changeRevision = ++changeRevisionRef.current;
    setPersistenceStatus("saving");
    const timeout = window.setTimeout(() => {
      const save = () => curriculumApi.put(tree, remoteRevisionRef.current, published, curriculumId);
      queueRef.current = queueRef.current.catch(() => undefined).then(save);
      void queueRef.current.then(
        result => {
          if (!result) return;
          remoteRevisionRef.current = result.revision;
          setRevision(result.revision);
          setUpdatedAt(result.updatedAt);
          if (changeRevisionRef.current === changeRevision) setPersistenceStatus("saved");
        },
        async error => {
          // A stale-revision conflict (another tab/session saved first) is
          // recoverable: pull the server's copy and adopt it, so we converge
          // on the shared truth instead of getting stuck in an error state
          // that only a manual reload could clear.
          if (error instanceof ApiError && error.status === 409) {
            try {
              const remote = await curriculumApi.get(curriculumId);
              if (remote.tree) {
                remoteRevisionRef.current = remote.revision;
                suppressSaveRef.current = true;
                setRevision(remote.revision);
                setOwner(remote.owner);
                setUpdatedAt(remote.updatedAt);
                setPublished(remote.published);
                setTree(remote.tree);
                if (changeRevisionRef.current === changeRevision) setPersistenceStatus("saved");
                return;
              }
            } catch {
              /* fall through to the error status below */
            }
          }
          if (changeRevisionRef.current === changeRevision) setPersistenceStatus("error");
        },
      );
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [tree, published, status, account?.id, account?.role, curriculumId]);

  return { tree, setTree, published, setPublished, persistenceStatus, loadError, owner, createdAt, updatedAt, revision };
}
