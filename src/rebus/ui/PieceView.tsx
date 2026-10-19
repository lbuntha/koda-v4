/**
 * One piece of a puzzle, drawn, and the row of them.
 *
 * Every puzzle is drawn by this one renderer from data. A picture is a drawing
 * (or, when it has none yet, its name); a word can be styled; a stack is one piece
 * of text over another; an operator is a plain sign. Written text is real text
 * so it scales with the page and can be read aloud, and each picture has an
 * accessible name, so a screen reader hears "germ plus money".
 */

import React from "react";
import type { Piece, WordStyle } from "../types";
import { SvgMarkup } from "../../assets/svg";
import { useIconMarkup } from "../icons/useRebusIcons";
import { usePieceImage } from "../photos";

const WORD_STYLE: Record<WordStyle, string> = {
  plain: "",
  cut: "[clip-path:polygon(0_0,36%_0,50%_46%,64%_0,100%_0,100%_100%,0_100%)]",
  small: "text-base",
  big: "text-6xl",
  "upside-down": "rotate-180",
};

/** One icon: the Art library's drawing if it has one, else the built-in, else its name. */
const IconPiece: React.FC<{ piece: Extract<Piece, { kind: "icon" }> }> = ({ piece }) => {
  const markup = useIconMarkup(piece.id);
  const size = piece.scale === "big" ? "h-28 w-28 sm:h-32 sm:w-32" : piece.scale === "small" ? "h-12 w-12" : "h-20 w-20 sm:h-24 sm:w-24";
  if (!markup) return <span className="rounded-xl border-2 border-dashed border-line px-3 py-2 text-sm font-black text-muted">{piece.name}</span>;
  return (
    /* Artwork sits on paper: a fixed light tile, so a drawing made for a white page reads the same in dark mode. */
    <span role="img" aria-label={piece.name} className={`${size} shrink-0 rounded-2xl border border-line bg-white p-1.5 shadow-sm`}>
      <SvgMarkup markup={markup} raw size="100%" />
    </span>
  );
};

const TILE_SIZE = { big: "h-28 w-28 sm:h-32 sm:w-32", small: "h-12 w-12", normal: "h-20 w-20 sm:h-24 sm:w-24" } as const;

/** One photo: on the same white tile as a drawing, whole (never cropped), or its name until it arrives. */
const PhotoPiece: React.FC<{ piece: Extract<Piece, { kind: "photo" }> }> = ({ piece }) => {
  const { url, failed } = usePieceImage(piece.id);
  const size = TILE_SIZE[piece.scale ?? "normal"];
  if (!url) {
    return failed ? (
      <span className="rounded-xl border-2 border-dashed border-line px-3 py-2 text-sm font-black text-muted">{piece.name}</span>
    ) : (
      <span role="img" aria-label={piece.name} className={`${size} shrink-0 animate-pulse rounded-2xl border border-line bg-surface-muted`} />
    );
  }
  return (
    <span role="img" aria-label={piece.name} className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-white shadow-sm`}>
      <img src={url} alt="" draggable={false} className="h-full w-full object-contain" />
    </span>
  );
};

export const PieceView: React.FC<{ piece: Piece }> = ({ piece }) => {
  switch (piece.kind) {
    case "photo":
      return <PhotoPiece piece={piece} />;
    case "icon":
      return <IconPiece piece={piece} />;
    case "word":
      return <span className={`text-5xl font-black tracking-tight text-ink ${WORD_STYLE[piece.style ?? "plain"]}`}>{piece.text}</span>;
    case "stack":
      return (
        <span className="flex flex-col items-center text-3xl font-black leading-tight text-ink">
          <span>{piece.top}</span>
          <span>{piece.bottom}</span>
        </span>
      );
    case "op":
      return (
        <span aria-hidden="true" className="text-4xl font-black text-ink">
          {piece.op === "-" ? "−" : piece.op}
        </span>
      );
  }
};

/** The puzzle itself, on the same sky-and-meadow ground every activity plays on. */
export const PuzzleCanvas: React.FC<{ pieces: readonly Piece[]; label: string }> = ({ pieces, label }) => (
  <div
    role="group"
    aria-label={label}
    className="flex min-h-40 flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-3xl border-2 border-line bg-gradient-to-b from-play-sky to-play-ground px-3 py-5"
  >
    {pieces.map((piece, i) => (
      <PieceView key={i} piece={piece} />
    ))}
  </div>
);
