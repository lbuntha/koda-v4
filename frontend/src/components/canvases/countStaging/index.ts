/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The staging registry. One entry per way of counting; the engine looks a
 * staging up by id and knows nothing else about it.
 *
 * `tens` turned out not to need the "ten ones become one ten" model this file
 * used to say it was waiting for. A ten-frame cell already *is* a numbered
 * place, so grouping is `ordersByPlacement` — the same decision Line Up makes —
 * and the tens are expressed by where the cells sit, not by objects merging.
 *
 * `arrangements` is `tap`'s act in an arena with a number track, and needed
 * nothing new from the contract — the readout role Count Back introduced turned
 * out to have a second user immediately, which is the test of whether an
 * abstraction was real or a one-off.
 *
 * `countback` was the one that paid for the rest. It forced the
 * engine to admit that "how many objects", "how many acts finish it" and "what
 * the answer is" are three numbers rather than one — `count`, `goal` and
 * `expected`. That was already quietly true of Count On; Count Back is just
 * where it stopped being deniable. Every staging that counts a whole board gets
 * all three from the same default, so none of them mention it.
 */

import { CountingTechnique } from "../../../types";
import type { CountStaging, CountStagingId } from "./types";
import { moveStaging } from "./move";
import { tapStaging } from "./tap";
import { lineupStaging } from "./lineup";
import { containerStaging } from "./container";
import { tensStaging } from "./tens";
import { countOnStaging } from "./counton";
import { countBackStaging } from "./countback";
import { arrangementsStaging } from "./arrangements";
import { skipCountStaging } from "./skipcount";

export const STAGINGS: Partial<Record<CountStagingId, CountStaging>> = {
  move: moveStaging,
  tap: tapStaging,
  lineup: lineupStaging,
  container: containerStaging,
  tens: tensStaging,
  counton: countOnStaging,
  countback: countBackStaging,
  arrangements: arrangementsStaging,
  skipcount: skipCountStaging
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
  [CountingTechnique.COUNT_MAGNETS]: "container",
  [CountingTechnique.GROUP_IN_TENS]: "tens",
  [CountingTechnique.COUNT_ON]: "counton",
  [CountingTechnique.COUNT_BACK]: "countback",
  [CountingTechnique.DIFFERENT_ARRANGEMENTS]: "arrangements"
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
export { tensStaging, PILE, FRAMES } from "./tens";
export { countOnStaging } from "./counton";
export { countBackStaging, SET, COUNTDOWN } from "./countback";
export { arrangementsStaging, ARENA, TRACK } from "./arrangements";
export { skipCountStaging, BUNDLES } from "./skipcount";
export { boardTotals, boardTotalsForTechnique, type BoardTotals } from "./boardTotals";
