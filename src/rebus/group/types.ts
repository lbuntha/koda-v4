/** A Rebus room as the server describes it. The shapes are shared with every game; see `group/types.ts`. */

import type { Puzzle } from "../types";
import type { RoomView as SharedRoomView, Seat as SharedSeat } from "../../group/types";

export type { Choices, PuzzleResult, RoomPlayer, RoomRequest, RoomStatus, Standing } from "../../group/types";

export interface RoomSettings {
  category: string;
  count: number;
  difficulty: 1 | 2 | 3 | null;
  maxPlayers: number;
  hintDelaySec: number;
  puzzleLimitSec: number;
  hintRungs: 1 | 2 | 3;
  pointsPerPuzzle: number;
  hintCost: number;
}

export type RoomView = SharedRoomView<RoomSettings, Puzzle>;
export type Seat = SharedSeat<RoomView>;
