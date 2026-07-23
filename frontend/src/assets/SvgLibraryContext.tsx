import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { svgAssetsApi, SvgOverride } from "../api/svgAssets";
import type { CustomSvgAsset } from "../types";
import { normalizeSvgAssetIds } from "./svgIds";

const LEGACY_ASSETS_KEY = "koda_custom_svg_assets";
const LEGACY_OVERRIDES_KEY = "koda_svg_overrides";
const LEGACY_MIGRATION_OWNER_KEY = "koda_svg_migration_owner";

export type SvgPersistenceStatus = "local" | "loading" | "saving" | "saved" | "error";

interface SvgLibraryContextValue {
  assets: CustomSvgAsset[];
  setAssets: React.Dispatch<React.SetStateAction<CustomSvgAsset[]>>;
  overrides: Record<string, SvgOverride>;
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, SvgOverride>>>;
  persistenceStatus: SvgPersistenceStatus;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function accountKey(base: string, ownerId: string): string {
  return `${base}:${ownerId}`;
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const SvgLibraryContext = createContext<SvgLibraryContextValue | null>(null);

export const SvgLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, account } = useAuth();
  const [assets, setAssets] = useState<CustomSvgAsset[]>(() => readJson(LEGACY_ASSETS_KEY, []));
  const [overrides, setOverrides] = useState<Record<string, SvgOverride>>(() => readJson(LEGACY_OVERRIDES_KEY, {}));
  const [persistenceStatus, setPersistenceStatus] = useState<SvgPersistenceStatus>("local");
  const hydratedRef = useRef(false);
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
        writeJson(accountKey(LEGACY_ASSETS_KEY, ownerId), nextAssets);
        writeJson(accountKey(LEGACY_OVERRIDES_KEY, ownerId), nextOverrides);
        hydratedRef.current = true;
        setPersistenceStatus("saved");
      } catch {
        if (cancelled) return;
        const cachedAssets = readJson<CustomSvgAsset[]>(accountKey(LEGACY_ASSETS_KEY, ownerId), []);
        const cachedOverrides = readJson<Record<string, SvgOverride>>(accountKey(LEGACY_OVERRIDES_KEY, ownerId), {});
        setAssets(cachedAssets);
        setOverrides(cachedOverrides);
        hydratedRef.current = true;
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
    writeJson(accountKey(LEGACY_ASSETS_KEY, ownerId), assets);
    writeJson(accountKey(LEGACY_OVERRIDES_KEY, ownerId), overrides);
    const revision = ++saveRevisionRef.current;
    setPersistenceStatus("saving");

    const timeout = window.setTimeout(() => {
      const save = () => svgAssetsApi.put({ assets, overrides, revision: remoteRevisionRef.current });
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
  }, [assets, overrides, status, account?.id, account?.role]);

  const value = useMemo<SvgLibraryContextValue>(
    () => ({ assets, setAssets, overrides, setOverrides, persistenceStatus }),
    [assets, overrides, persistenceStatus]
  );

  return <SvgLibraryContext.Provider value={value}>{children}</SvgLibraryContext.Provider>;
};

export function useSvgLibrary(): SvgLibraryContextValue {
  const context = useContext(SvgLibraryContext);
  if (!context) throw new Error("useSvgLibrary must be used inside SvgLibraryProvider");
  return context;
}
