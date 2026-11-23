/** The Rebus seat this tab holds; see `group/seatStore.ts`. */

import * as shared from "../../group/seatStore";

export type { StoredSeat } from "../../group/seatStore";

const KEY = "koda.rebus.seat";

export const loadSeat = () => shared.loadSeat(KEY);
export const saveSeat = (seat: shared.StoredSeat) => shared.saveSeat(KEY, seat);
export const clearSeat = () => shared.clearSeat(KEY);
