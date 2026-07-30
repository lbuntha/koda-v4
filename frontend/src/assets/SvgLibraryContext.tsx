import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { mayPersistRemotely } from "../api/persistenceGuard";
import { svgAssetsApi, SvgOverride } from "../api/svgAssets";
import type { CustomSvgAsset } from "../types";
import { normalizeSvgAssetIds } from "./svgIds";
import {
  ASSETS_KEY as LEGACY_ASSETS_KEY,
  OVERRIDES_KEY as LEGACY_OVERRIDES_KEY,
  THUMBNAILS_KEY,
  accountKey,
  readCache,
  readJson,
  writeCache,
  writeJson,
} from "./libraryCache";

const LEGACY_MIGRATION_OWNER_KEY = "koda_svg_migration_owner";

export type SvgPersistenceStatus = "local" | "loading" | "saving" | "saved" | "error";

interface SvgLibraryContextValue {
  assets: CustomSvgAsset[];
  setAssets: React.Dispatch<React.SetStateAction<CustomSvgAsset[]>>;
  overrides: Record<string, SvgOverride>;
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, SvgOverride>>>;
  /** Counting technique -> SVG asset id, replacing that component's static artwork. */
  techniqueThumbnails: Record<string, string>;
  setTechniqueThumbnails: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  persistenceStatus: SvgPersistenceStatus;
}

const SvgLibraryContext = createContext<SvgLibraryContextValue | null>(null);

export const SvgLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, account } = useAuth();
  const [assets, setAssets] = useState<CustomSvgAsset[]>(() => readJson(LEGACY_ASSETS_KEY, []));
  const [overrides, setOverrides] = useState<Record<string, SvgOverride>>(() => readJson(LEGACY_OVERRIDES_KEY, {}));
  const [techniqueThumbnails, setTechniqueThumbnails] = useState<Record<string, string>>({});
  const [persistenceStatus, setPersistenceStatus] = useState<SvgPersistenceStatus>("local");
  const hydratedRef = useRef(false);
  /**
   * True when the last load failed and local state is therefore a cache, not the account's
   * library. Saving in that condition would push a partial picture over a server copy we
   * never managed to read — see the guard in the save effect.
   */
  const hydrationFailedRef = useRef(false);
  const saveRevisionRef = useRef(0);
  const remoteRevisionRef = useRef(0);
  const saveQueueRef = useRef<Promise<{ ok: true; revision: number } | undefined>>(Promise.resolve(undefined));

  useEffect(() => {
    if (status !== "authenticated" || !account || account.role === "student") {
      hydratedRef.current = false;
      setPersistenceStatus("local");
      return;
    }

    let cancelled = false;
    const ownerId = account.id;
    hydratedRef.current = false;
    hydrationFailedRef.current = false;
    setPersistenceStatus("loading");

    void (async () => {
      try {
        const remote = await svgAssetsApi.get();
        if (cancelled) return;

        let nextAssets = normalizeSvgAssetIds(remote.assets);
        let nextOverrides = remote.overrides;
        remoteRevisionRef.current = remote.revision;

        const accountAssets = readJson<CustomSvgAsset[]>(accountKey(LEGACY_ASSETS_KEY, ownerId), []);
        const accountOverrides = readJson<Record<string, SvgOverride>>(accountKey(LEGACY_OVERRIDES_KEY, ownerId), {});
        const legacyAssets = readJson<CustomSvgAsset[]>(LEGACY_ASSETS_KEY, []);
        const legacyOverrides = readJson<Record<string, SvgOverride>>(LEGACY_OVERRIDES_KEY, {});
        const importAssets = accountAssets.length > 0 ? accountAssets : legacyAssets;
        const importOverrides = Object.keys(accountOverrides).length > 0 ? accountOverrides : legacyOverrides;
        const hasLocalContent = importAssets.length > 0 || Object.keys(importOverrides).length > 0;
        const remoteIsEmpty = nextAssets.length === 0 && Object.keys(nextOverrides).length === 0;

        // A previous app version could create an empty Mongo document before
        // discovering browser data. An empty remote is safe to hydrate from a
        // non-empty local library; a non-empty remote always remains authoritative.
        if (!remote.exists || (remoteIsEmpty && hasLocalContent)) {
          nextAssets = normalizeSvgAssetIds(importAssets);
          nextOverrides = importOverrides;

          const created = await svgAssetsApi.put({
            assets: nextAssets,
            overrides: nextOverrides,
            techniqueThumbnails: {},
            revision: remote.revision,
          });
          remoteRevisionRef.current = created.revision;
          if (hasLocalContent) {
            localStorage.setItem(LEGACY_MIGRATION_OWNER_KEY, ownerId);
            // MongoDB is authoritative now. Removing the unscoped legacy keys
            // prevents a second account on this browser from importing them.
            localStorage.removeItem(LEGACY_ASSETS_KEY);
            localStorage.removeItem(LEGACY_OVERRIDES_KEY);
          }
        }

        if (cancelled) return;
        setAssets(nextAssets);
        setOverrides(nextOverrides);
        const nextThumbnails = remote.techniqueThumbnails || {};
        setTechniqueThumbnails(nextThumbnails);
        writeCache(ownerId, {
          assets: nextAssets, overrides: nextOverrides, techniqueThumbnails: nextThumbnails,
        });
        hydratedRef.current = true;
        setPersistenceStatus("saved");
      } catch {
        if (cancelled) return;
        // Show the cached library so the studio still works, but every part of it — including
        // the thumbnails, which used to be left empty here — so an edit can't push a
        // half-remembered picture back over the server copy.
        const cached = readCache(ownerId);
        setAssets(cached.assets);
        setOverrides(cached.overrides);
        setTechniqueThumbnails(cached.techniqueThumbnails);
        hydratedRef.current = true;
        hydrationFailedRef.current = true;
        setPersistenceStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, account?.id, account?.role]);

  useEffect(() => {
    if (status !== "authenticated" || !account || account.role === "student" || !hydratedRef.current) {
      if (status === "offline") {
        writeJson(LEGACY_ASSETS_KEY, assets);
        writeJson(LEGACY_OVERRIDES_KEY, overrides);
      }
      return;
    }

    const ownerId = account.id;
    writeCache(ownerId, { assets, overrides, techniqueThumbnails });

    // Local cache updated either way; the remote write is what a failed load forfeits.
    //
    // `remoteRevisionRef` survives across loads, so after one successful load it holds a
    // revision the server will still accept. A later load that fails would otherwise write
    // cached state over the real library and report "Saved" — losing artwork choices the
    // failed GET never told us about. Reading has to succeed before writing is allowed.
    if (!mayPersistRemotely({
      hydrated: hydratedRef.current, hydrationFailed: hydrationFailedRef.current,
    })) {
      setPersistenceStatus("error");
      return;
    }

    const revision = ++saveRevisionRef.current;
    setPersistenceStatus("saving");

    const timeout = window.setTimeout(() => {
      const save = () => svgAssetsApi.put({ assets, overrides, techniqueThumbnails, revision: remoteRevisionRef.current });
      // Swallows only the *previous* save's rejection, so one failure doesn't poison the
      // queue for every later save. This save's own outcome is handled below.
      saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(save);
      void saveQueueRef.current.then(
        (result) => {
          if (!result) return;
          remoteRevisionRef.current = result.revision;
          if (saveRevisionRef.current === revision) setPersistenceStatus("saved");
        },
        () => {
          if (saveRevisionRef.current === revision) setPersistenceStatus("error");
        }
      );
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [assets, overrides, techniqueThumbnails, status, account?.id, account?.role]);

  const value = useMemo<SvgLibraryContextValue>(
    () => ({
      assets, setAssets, overrides, setOverrides,
      techniqueThumbnails, setTechniqueThumbnails, persistenceStatus,
    }),
    [assets, overrides, techniqueThumbnails, persistenceStatus]
  );

  return <SvgLibraryContext.Provider value={value}>{children}</SvgLibraryContext.Provider>;
};

export function useSvgLibrary(): SvgLibraryContextValue {
  const context = useContext(SvgLibraryContext);
  if (!context) throw new Error("useSvgLibrary must be used inside SvgLibraryProvider");
  return context;
}
