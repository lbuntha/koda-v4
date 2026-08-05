/**
 * Sizing and slot maths for canvases that lay draggable objects out in bins.
 *
 * Counting canvases used to hardcode their object size ("52 on a phone, 64
 * otherwise"). That reads fine on the device it was tuned on and nowhere else:
 * on a tablet or a classroom projector the same 64px counter leaves two mostly
 * empty bins, and on a cramped preview card it overflows. Every canvas also
 * grew its own copy of the arithmetic, so the same activity looked different
 * depending on which file drew it.
 *
 * The rule here is the shared one: an object's size comes from the room its bin
 * actually has. Lay the objects out as a grid, take most of one cell, clamp so
 * it never drops below a draggable target or grows into clip art. Spacing is
 * expressed as multiples of the object, so a big object on a big screen gets
 * proportionally big gaps rather than the gaps a 64px object needed.
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Hard floor: still a drag target for a small hand. Ceiling: still an object, not wallpaper. */
export const OBJECT_SIZE = { min: 36, max: 136 } as const;

/**
 * Space a bin's own chrome (padding, rounded corners) takes off its inner area.
 *
 * This tracks `CanvasBin`'s `p-3 sm:p-4 md:p-5` — 12 to 20 pixels a side. It used
 * to be set at 28, which is nobody's padding: on a short band (a tray, a shelf)
 * the overstatement ate the whole content area and every object came back at the
 * `OBJECT_SIZE.min` floor regardless of how much room the stage really had.
 */
export const BIN_PADDING = 16;

/** Height of a bin's caption row, measured off the top of its content area. */
export const BIN_CAPTION_INSET = 30;

/** Fraction of a grid cell an object fills — the rest is breathing room. */
const CELL_FILL = 0.82;

/**
 * The arrangement of `count` objects that makes each one biggest in this space.
 *
 * A square-ish grid is the obvious choice and the wrong one: five objects in a
 * bin that is wide and short — a phone, where the bins stack — come out as 3+2
 * and are sized by the two rows, when a single row of five would have made each
 * object half again as big. Trying every column count is cheap (a bin holds
 * tens of objects, not thousands) and always lands on the best fit.
 */
export const bestGrid = (count: number, width: number, height: number) => {
  const total = Math.max(1, count);
  let best = { columns: total, rows: 1, cell: 0 };
  for (let columns = 1; columns <= total; columns++) {
    const rows = Math.ceil(total / columns);
    const cell = Math.min(width / columns, height / rows);
    if (cell > best.cell) best = { columns, rows, cell };
  }
  return best;
};

export interface FitObjectSizeOptions {
  /** Inner size of the bin the objects have to fit into. */
  width: number;
  height: number;
  /** How many objects share that bin. */
  count: number;
  /** Bin chrome to discount, per side. */
  padding?: number;
  /** Caption row to discount off the height. */
  captionInset?: number;
  min?: number;
  max?: number;
}

/** The largest object size whose grid still fits the bin. */
export const fitObjectSize = ({
  width,
  height,
  count,
  padding = BIN_PADDING,
  captionInset = BIN_CAPTION_INSET,
  min = OBJECT_SIZE.min,
  max = OBJECT_SIZE.max
}: FitObjectSizeOptions): number => {
  const usableWidth = Math.max(min, width - padding * 2);
  const usableHeight = Math.max(min, height - captionInset - padding * 2);
  const { cell } = bestGrid(count, usableWidth, usableHeight);
  return Math.round(Math.max(min, Math.min(max, cell * CELL_FILL)));
};

/**
 * Size of one bin when a stage is split in two.
 *
 * Wide stages put the bins side by side, narrow ones stack them — which flips
 * whether the split costs width or height.
 */
export const binSizeForStage = (
  stageWidth: number,
  stageHeight: number,
  { stacked, gap = stacked ? 12 : 16 }: { stacked: boolean; gap?: number }
) => ({
  width: stacked ? stageWidth : (stageWidth - gap) / 2,
  height: stacked ? (stageHeight - gap) / 2 : stageHeight
});

/**
 * The size a counting object should be on this stage — the one number every
 * counting canvas starts from.
 *
 * Move & Count is the reference activity, so this is literally what it computes:
 * split the stage in two, fit `count` objects into one half. A child moving from
 * Move & Count to Magnets to Count On sees the same apple at the same size, which
 * is the whole point of having a rule rather than a per-canvas guess. A canvas may
 * end up smaller only when a real slot geometry forces it — a ten-frame cell is
 * five across, and that is not negotiable.
 */
export const countingObjectSize = ({
  stageWidth,
  stageHeight,
  count,
  stacked
}: {
  stageWidth: number;
  stageHeight: number;
  count: number;
  stacked: boolean;
}) => {
  const bin = binSizeForStage(stageWidth, stageHeight, { stacked });
  return fitObjectSize({ width: bin.width, height: bin.height, count });
};

/** A child element's box, in stage coordinates. */
export const relativeRect = (element: HTMLElement, stageRect: DOMRect): Rect => {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left - stageRect.left,
    top: rect.top - stageRect.top,
    width: rect.width,
    height: rect.height
  };
};

/** The part of a bin objects may occupy — below its caption, inside its padding. */
export const contentZone = (zone: Rect, objectSize: number, captionInset = BIN_CAPTION_INSET): Rect => ({
  left: zone.left,
  top: zone.top + captionInset,
  width: zone.width,
  height: Math.max(objectSize, zone.height - captionInset - 12)
});

/**
 * Where the `order`-th of `total` objects sits when they are *piled* into a
 * container rather than laid out in a tray.
 *
 * A jar or a basket has a small mouth, and sizing the objects to fit a grid
 * inside it is what made an apple in the basket half the size of the same apple
 * on the shelf. Real objects in a real jar overlap, so these do too: the step
 * shrinks below one object before the object itself ever does, and rows stack
 * from the bottom so the pile fills upward as it grows.
 */
export const pilePosition = (
  order: number,
  total: number,
  zone: Rect,
  objectSize: number = 64
) => {
  // Down to ~40% overlap before anything has to get smaller.
  const minStep = Math.round(objectSize * 0.6);
  const columns = Math.max(
    1,
    Math.min(total, Math.floor((zone.width - objectSize) / minStep) + 1)
  );
  const rows = Math.ceil(total / columns);

  const stepFor = (available: number, cellCount: number, maxStep: number) =>
    cellCount > 1
      ? Math.max(minStep, Math.min(maxStep, (available - objectSize) / (cellCount - 1)))
      : 0;

  const stepX = stepFor(zone.width, columns, Math.round(objectSize * 1.05));
  const stepY = stepFor(zone.height, rows, Math.round(objectSize * 0.95));

  const column = (order - 1) % columns;
  const row = Math.floor((order - 1) / columns);
  const inThisRow = Math.max(1, Math.min(columns, total - row * columns));
  const rowWidth = objectSize + (inThisRow - 1) * stepX;
  const pileHeight = objectSize + (rows - 1) * stepY;

  return {
    // Rows fill from the bottom of the container up, the way a pile grows.
    x: Math.round(zone.left + (zone.width - rowWidth) / 2 + column * stepX),
    y: Math.round(zone.top + Math.max(0, zone.height - pileHeight) + (rows - 1 - row) * stepY)
  };
};

/**
 * Where the `order`-th of `total` objects sits inside a zone, centred as a grid.
 *
 * Spacing scales with the object rather than being a fixed pixel gap, so the
 * arrangement reads the same whether the objects are 40px or 130px.
 */
export const slotPosition = (
  order: number,
  total: number,
  zone: Rect,
  objectSize: number = 64
) => {
  const padding = Math.round(objectSize * 0.22);
  const usableWidth = Math.max(objectSize, zone.width - padding * 2);
  const usableHeight = Math.max(objectSize, zone.height - padding * 2);
  const gutter = Math.round(objectSize * 0.16);
  const maxColumns = Math.max(1, Math.floor((usableWidth + gutter) / (objectSize + gutter)));
  // Same arrangement the size was chosen for, capped at what actually fits across.
  const columns = Math.max(1, Math.min(total, maxColumns, bestGrid(total, usableWidth, usableHeight).columns));
  const rows = Math.ceil(total / columns);
  const column = (order - 1) % columns;
  const row = Math.floor((order - 1) / columns);

  const minStep = Math.round(objectSize * 1.18);
  const maxStep = Math.round(objectSize * 1.5);
  const stepFor = (available: number, cellCount: number) =>
    cellCount > 1
      ? Math.max(minStep, Math.min(maxStep, (available - objectSize) / (cellCount - 1)))
      : 0;

  const gapX = stepFor(usableWidth, columns);
  const gapY = stepFor(usableHeight, rows);
  const contentHeight = objectSize + (rows - 1) * gapY;

  // Each row is centred on its own width, not the widest row's. Five objects in
  // a 3+2 grid otherwise leave a hole under the third column, which a child
  // reads as "one is missing" rather than as a group of five.
  const inThisRow = Math.max(1, Math.min(columns, total - row * columns));
  const rowWidth = objectSize + (inThisRow - 1) * gapX;

  return {
    x: Math.round(zone.left + (zone.width - rowWidth) / 2 + column * gapX),
    y: Math.round(zone.top + (zone.height - contentHeight) / 2 + row * gapY)
  };
};
