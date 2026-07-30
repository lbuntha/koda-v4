/**
 * When a locally-cached store may be written back to the server.
 *
 * Three stores autosave the same way — the SVG library, the question deck, and the curriculum
 * tree. Each loads once, keeps a `revision` the server checks on write, and debounces saves.
 * The revision alone looked like enough protection. It is not:
 *
 * `remoteRevisionRef` outlives a single load. After one successful load it holds a revision
 * the server will still accept, so a *later* load that fails leaves the app holding cached
 * (or default) state, a valid revision, and no idea what it failed to read. The next edit
 * writes that over the real data and the UI reports "Saved".
 *
 * The rule is therefore: reading has to succeed before writing is allowed.
 */
export interface HydrationState {
  /** A load attempt has finished, successfully or not. */
  hydrated: boolean;
  /** That attempt failed, so local state is a cache rather than the truth. */
  hydrationFailed: boolean;
}

export function mayPersistRemotely({ hydrated, hydrationFailed }: HydrationState): boolean {
  return hydrated && !hydrationFailed;
}
