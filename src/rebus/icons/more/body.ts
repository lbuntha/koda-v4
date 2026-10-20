/** Parts of the body, and the things a person does with them. */

import { PAL as P, circle, path } from "../draw";

export const BODY: Record<string, string> = {
  foot:
    path("M18 6h16c2 10 2 20 6 28 5 2 14 4 14 14 0 6-4 10-10 10H20c-6 0-10-4-10-10 0-8 8-10 8-18z", P.cream, P.brown) +
    circle(40, 12, 3.4, P.cream, P.brown) + circle(46, 20, 3, P.cream, P.brown) + circle(50, 29, 2.8, P.cream, P.brown) + circle(52, 37, 2.6, P.cream, P.brown),
  hand:
    path("M20 30V14c0-4 6-4 6 0v12V10c0-4 6-4 6 0v16V12c0-4 6-4 6 0v16V18c0-4 6-4 6 0v22c0 12-6 18-16 18s-14-6-16-14l-6-10c-2-4 3-7 6-4z", P.cream, P.brown),
};
