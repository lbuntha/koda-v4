/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The staging registry. One entry per way of counting; the engine looks a
 * staging up by id and knows nothing else about it.
 *
 * Still to fold in (see `docs/component-consolidation.md` §3):
 *   - `tens` — group into tens, from `CountCratesCanvas`, which already keeps its
 *     rules in `countCratesModel.ts` and needs a staging that can express
 *     "ten ones become one ten" rather than one object one count.
 */

import { CountingTechnique } from "../../../types";
import type { CountStaging, CountStagingId } from "./types";
import { moveStaging } from "./move";
import { tapStaging } from "./tap";
import { lineupStaging } from "./lineup";
import { containerStaging } from "./container";

export const STAGINGS: Partial<Record<CountStagingId, CountStaging>> = {
  move: moveStaging,
  tap: tapStaging,
  lineup: lineupStaging,
  container: containerStaging
};

/**
 * What each retired technique used to be.
 *
 * Published releases are immutable: 160 `MOVE_AND_COUNT` questions, 130
 * `COUNT_ON` and 10 `ONE_TO_ONE` are inside releases that learners are assigned
 * to, and none of them carry a `staging` field because none existed when they
 * were authored. Their technique id has to keep meaning exactly what it meant,
 * forever — so the id is the fallback, and the merge changes only what the
 * studio offers.
 */
export const STAGING_BY_TECHNIQUE: Partial<Record<CountingTechnique, CountStagingId>> = {
  [CountingTechnique.MOVE_AND_COUNT]: "move",
  [CountingTechnique.ONE_TO_ONE]: "tap",
  [CountingTechnique.LINE_UP_AND_COUNT]: "lineup",
  [CountingTechnique.COUNT_MAGNETS]: "container"
};

/**
 * The staging for a slide: what it says, else what its technique always meant,
 * else `move` — the staging the reference activity was authored against.
 */
export const stagingFor = (
  id: string | undefined,
  technique?: CountingTechnique
): CountStaging =>
  STAGINGS[id as CountStagingId] ??
  STAGINGS[(technique && STAGING_BY_TECHNIQUE[technique]) as CountStagingId] ??
  moveStaging;

export * from "./types";
export { moveStaging, WAITING, COUNTED } from "./move";
export { tapStaging } from "./tap";
export { lineupStaging, TRAY, LINE } from "./lineup";
export { containerStaging, SHELF, VESSEL } from "./container";
