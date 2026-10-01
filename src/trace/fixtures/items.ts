/**
 * Hand-made trace items for tests and for the Phase 1 player.
 *
 * The Khmer shapes here are rough sketches with plausible stroke counts, made
 * to exercise the scorer (retracing, continued strokes, corners, a head curl).
 * They are NOT the published letters or their stroke order — those are drawn
 * and numbered by an admin in Trace Studio.
 */

import { blendAll, setNodeType } from "../geometry/edit";
import type { Checkpoint, Stroke, StrokeShape, TraceItem, TraceNode, Zone } from "../geometry/types";

interface StrokeOptions {
  shape?: StrokeShape;
  closed?: boolean;
  join?: "lift" | "continue";
  /** Round every inner node. */
  smooth?: boolean;
  /** Round only these node indexes. */
  smoothAt?: number[];
  width?: number;
  radius?: number;
  zone?: Zone;
  pinned?: number[];
}

export function makeStroke(id: string, order: number, points: [number, number][], o: StrokeOptions = {}): Stroke {
  const nodes: TraceNode[] = points.map(([x, y]) => ({ x, y, type: "corner" }));
  const checkpoints: Checkpoint[] = (o.pinned ?? []).map((t) => ({ t, pinned: true }));
  let stroke: Stroke = {
    id,
    order,
    shape: o.shape ?? (points.length === 1 ? "dot" : points.length === 2 ? "line" : "curve"),
    nodes,
    closed: o.closed ?? false,
    join: o.join ?? "lift",
    width: o.width ?? 60,
    radius: o.radius,
    zone: o.zone,
    checkpoints,
  };
  if (o.smooth) stroke = blendAll(stroke);
  for (const i of o.smoothAt ?? []) stroke = setNodeType(stroke, i, "smooth");
  return stroke;
}

const item = (id: string, title: string, kind: TraceItem["kind"], strokes: Stroke[], extra: Partial<TraceItem> = {}): TraceItem => ({
  id,
  rev: 1,
  title,
  kind,
  grid: "none",
  strokes,
  sensitivity: "balanced",
  ...extra,
});

export const LINE = item("line-down", "Line down", "line", [makeStroke("s1", 1, [[500, 150], [500, 850]])]);

export const LOOP = item("loop", "Loop", "line", [
  makeStroke(
    "s1",
    1,
    [
      [500, 200],
      [200, 500],
      [500, 800],
      [800, 500],
    ],
    { shape: "loop", closed: true, smooth: true },
  ),
]);

export const HOOK = item("hook", "Hook", "line", [
  makeStroke(
    "s1",
    1,
    [
      [400, 150],
      [400, 600],
      [470, 780],
      [620, 720],
    ],
    { shape: "hook", smoothAt: [2], pinned: [0.9] },
  ),
]);

export const KHA = item(
  "km-kha-sketch",
  "ខ",
  "letter",
  [
    makeStroke(
      "s1",
      1,
      [
        [330, 250],
        [250, 260],
        [240, 340],
        [300, 360],
        [300, 780],
      ],
      { shape: "hook", smoothAt: [1, 2] },
    ),
    makeStroke(
      "s2",
      2,
      [
        [300, 780],
        [320, 420],
        [420, 330],
        [520, 420],
        [530, 780],
      ],
      { join: "continue", smoothAt: [1, 2, 3] },
    ),
    makeStroke(
      "s3",
      3,
      [
        [530, 780],
        [560, 420],
        [660, 330],
        [760, 420],
        [760, 780],
      ],
      { join: "continue", smoothAt: [1, 2, 3] },
    ),
  ],
  { script: "khmer", grid: "4x3-moeys" },
);

export const CHA = item(
  "km-cha-sketch",
  "ច",
  "letter",
  [
    makeStroke(
      "s1",
      1,
      [
        [330, 250],
        [250, 270],
        [250, 350],
        [310, 360],
        [310, 780],
        [700, 780],
        [700, 300],
      ],
      { shape: "free", smoothAt: [1, 2] },
    ),
    makeStroke("s2", 2, [
      [600, 300],
      [800, 300],
    ]),
  ],
  { script: "khmer", grid: "4x3-moeys" },
);

export const SEVEN = item(
  "numeral-7",
  "7",
  "numeral",
  [
    makeStroke("s1", 1, [
      [250, 200],
      [750, 200],
    ]),
    makeStroke(
      "s2",
      2,
      [
        [750, 200],
        [420, 850],
      ],
      { join: "continue" },
    ),
  ],
  { script: "latin" },
);

export const CAT = item("cat", "Cat", "drawing", [
  makeStroke(
    "head",
    1,
    [
      [500, 320],
      [220, 560],
      [500, 800],
      [780, 560],
    ],
    { shape: "loop", closed: true, smooth: true },
  ),
  makeStroke("ear-left", 2, [
    [300, 420],
    [320, 170],
    [440, 340],
  ]),
  makeStroke("ear-right", 3, [
    [560, 340],
    [680, 170],
    [700, 420],
  ]),
  makeStroke("eye-left", 4, [[410, 540]], { radius: 25 }),
  makeStroke("eye-right", 5, [[590, 540]], { radius: 25 }),
  makeStroke("whisker-left", 6, [
    [260, 650],
    [400, 630],
  ]),
  makeStroke("whisker-right", 7, [
    [600, 630],
    [740, 650],
  ]),
]);

/** ◌ា written to the right of a faded ក. */
export const AA_MARK = item(
  "km-aa-sketch",
  "ា",
  "mark",
  [
    makeStroke(
      "s1",
      1,
      [
        [640, 420],
        [720, 370],
        [780, 430],
        [780, 800],
      ],
      { shape: "hook", smoothAt: [1, 2] },
    ),
  ],
  { script: "khmer", carrier: { text: "ក", box: { x: 150, y: 350, w: 450, h: 450 } }, zone: "right" },
);

export const GOLDEN_ITEMS = [LINE, LOOP, HOOK, KHA, CHA, SEVEN, CAT, AA_MARK];
