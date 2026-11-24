/**
 * Photos in puzzles: shown to anyone playing, kept on the device for offline.
 *
 * A photo piece is `photo-<sha256>`, uploaded by a Studio author and kept with
 * the library's photos. Players fetch it from an open route that only answers
 * for a photo a puzzle shows (a guest in a group room has no account), the
 * library's cache keeps it, and the published list is fetched together with its
 * photos, so a puzzle never shows an empty frame on a train.
 *
 * A photo that cannot be reached is not a broken image: the piece shows its
 * name, as a drawing that has not arrived does.
 */

import { useEffect, useState } from "react";
import { isPhoto, knownPhotoUrl, photoUrl } from "../library/photos";
import type { Puzzle } from "./types";

/** Where players read a puzzle's photo. */
export const PHOTO_ROUTE = "rebus/images";
/** Where a Studio author uploads one. */
export const UPLOAD_ROUTE = "rebus/studio/images";
/** A piece is drawn at most about 130px wide, so 640 covers a phone at three times the pixel density. */
export const PIECE_PHOTO_SIDE = 640;
/** How many are fetched at once. A phone on a weak link does worse with more. */
const AT_A_TIME = 3;

export const photosIn = (puzzles: readonly Puzzle[]): string[] =>
  [...new Set(puzzles.flatMap((p) => p.pieces.flatMap((piece) => (piece.kind === "photo" && isPhoto(piece.id) ? [piece.id] : []))))];

export interface PieceImage {
  url: string | null;
  /** True once it has been asked for and could not be had. */
  failed: boolean;
}

export const usePieceImage = (key: string): PieceImage => {
  const [state, setState] = useState<PieceImage>(() => ({ url: knownPhotoUrl(key), failed: false }));
  useEffect(() => {
    let live = true;
    void photoUrl(key, PHOTO_ROUTE).then((url) => {
      if (live) setState({ url, failed: url === null });
    });
    return () => {
      live = false;
    };
  }, [key]);
  return state;
};

/** Most photos fetched ahead of play when the bank changes. */
export const AHEAD_MAX = 60;

/**
 * The puzzles worth having photos for before the child asks: unplayed ones in
 * the categories they already play, up to `AHEAD_MAX` photos.
 *
 * Not the whole bank. Every device downloading every puzzle photo whenever an
 * owner published one more would be thousands of images on a metered line,
 * most of them for categories this child never opens. A round's own photos are
 * fetched when it starts (`useRebusRound`), so nothing played goes without.
 */
export const puzzlesAhead = (bank: readonly Puzzle[], seen: readonly string[]): Puzzle[] => {
  const played = new Set(seen);
  const categories = new Set(bank.filter((p) => played.has(p.id)).map((p) => p.category));
  const picked: Puzzle[] = [];
  let photos = 0;
  for (const p of bank) {
    if (!categories.has(p.category) || played.has(p.id)) continue;
    const count = photosIn([p]).length;
    if (count === 0) continue;
    if (photos + count > AHEAD_MAX) break;
    picked.push(p);
    photos += count;
  }
  return picked;
};

/** Fetch these puzzles' photos now, a few at a time, never blocking and never failing loudly. */
export const prefetchPuzzlePhotos = async (puzzles: readonly Puzzle[]): Promise<void> => {
  const keys = photosIn(puzzles);
  let next = 0;
  const worker = async () => {
    while (next < keys.length) {
      try {
        await photoUrl(keys[next++], PHOTO_ROUTE);
      } catch {
        /* Left for the next time the list is fetched. */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_A_TIME, keys.length) }, worker));
};
