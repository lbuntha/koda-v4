/** The lesson-race seat this tab holds; see `group/seatStore.ts`. */

import * as shared from "../seatStore";

const KEY = "koda.race.seat";

export const loadRaceSeat = () => shared.loadSeat(KEY);
export const saveRaceSeat = (seat: shared.StoredSeat) => shared.saveSeat(KEY, seat);
export const clearRaceSeat = () => shared.clearSeat(KEY);
