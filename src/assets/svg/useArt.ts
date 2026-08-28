import { useEffect, useSyncExternalStore } from "react";

import { SharedArtStore } from "../../lib/sharedArtStore";
import { ArtStore } from "../../lib/sync/artStore";
import { hasSvgAsset, svgAssets } from "./registry";

/**
 * Every id filed under one collection, across the art libraries.
 *
 * The same order `SvgAsset` resolves markup in — family, shared, bundle —
 * deduped by id, so a family asset overriding a shipped one is offered once.
 * A picker built on this shows art the moment somebody files it on the Art
 * page, without waiting for a release to bundle it.
 *
 * Empty is a normal state: it means nobody has drawn any yet, and a picker
 * should say so rather than look broken.
 */
export const useArtCategory = (category: string): string[] => {
  useSyncExternalStore(ArtStore.subscribe, ArtStore.version, ArtStore.version);
  useSyncExternalStore(SharedArtStore.subscribe, SharedArtStore.version, SharedArtStore.version);

  useEffect(() => {
    void ArtStore.load();
    void SharedArtStore.load();
  }, []);

  const ids = new Set<string>();
  for (const asset of ArtStore.all().values()) {
    if (asset.category === category) ids.add(asset.id);
  }
  for (const asset of SharedArtStore.all()) {
    if (asset.category === category) ids.add(asset.id);
  }
  // Once a complete shared snapshot has arrived it decides what exists, the
  // same rule `SvgAsset` renders by — otherwise a picker would offer a bundled
  // tile an operator deleted, and the tile would draw blank when picked.
  if (!SharedArtStore.isAuthoritative()) {
    for (const asset of svgAssets) {
      if (asset.category === category) ids.add(asset.id);
    }
  }
  return [...ids].sort();
};

/**
 * Whether an id names artwork in any of the libraries.
 *
 * `hasSvgAsset` answers for the bundle alone, which is the wrong question
 * anywhere a family or the shared collection can supply art the build never
 * saw: a thumbnail set to a shared-only id looked like "not artwork" and got
 * printed as its own letters. This asks the same three stores `SvgAsset` draws
 * from, in the same order, so what is claimed to exist is what will render.
 */
export const useHasArt = (id: string): boolean => {
  useSyncExternalStore(ArtStore.subscribe, ArtStore.version, ArtStore.version);
  useSyncExternalStore(SharedArtStore.subscribe, SharedArtStore.version, SharedArtStore.version);

  useEffect(() => {
    void ArtStore.load();
    void SharedArtStore.load();
  }, []);

  if (ArtStore.get(id) || SharedArtStore.get(id)) return true;
  // A complete shared snapshot decides; before it lands the bundle answers.
  return SharedArtStore.isAuthoritative() ? false : hasSvgAsset(id);
};
