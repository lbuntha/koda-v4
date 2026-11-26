import React from "react";
import type { Colour } from "../internal/compare";

/**
 * The things CompareBench draws, at any length.
 *
 * Each is built from fixed ends and a stretching middle (a pencil's tip and
 * eraser stay the same size; only the painted body grows), so a 3-space pencil
 * and a 15-space pencil are both clearly pencils, and the length a child judges
 * is the length the question holds. Every thing of one kind is drawn the same
 * way whatever the answer, so nothing but length gives the answer away.
 */

export const colourClass: Record<Colour, { body: string; light: string; border: string }> = {
  purple: { body: "bg-violet-500", light: "bg-violet-300", border: "border-violet-700" },
  blue: { body: "bg-sky-500", light: "bg-sky-300", border: "border-sky-700" },
  pink: { body: "bg-pink-500", light: "bg-pink-300", border: "border-pink-700" },
  green: { body: "bg-emerald-500", light: "bg-emerald-300", border: "border-emerald-700" },
};

const fillClass: Record<Colour, string> = {
  purple: "fill-violet-500",
  blue: "fill-sky-500",
  pink: "fill-pink-500",
  green: "fill-emerald-500",
};

export const ThingArt: React.FC<{ thing: string; colour: Colour; vertical?: boolean }> = ({ thing, colour }) => {
  const c = colourClass[colour];
  switch (thing) {
    case "pencil":
      return (
        <span className="flex h-full w-full items-stretch" aria-hidden="true">
          <span className="w-2 shrink-0 rounded-l-md bg-pink-200 dark:bg-pink-300" />
          <span className="w-1 shrink-0 bg-slate-400" />
          <span className={`flex-1 ${c.body}`} />
          <svg viewBox="0 0 14 20" preserveAspectRatio="none" className="h-full w-3.5 shrink-0">
            <path d="M0 0 L14 10 L0 20 Z" className="fill-orange-100 dark:fill-stone-300" />
            <path d="M9 6.4 L14 10 L9 13.6 Z" className="fill-slate-800" />
          </svg>
        </span>
      );
    case "crayon":
      return (
        <span className="flex h-full w-full items-stretch py-0.5" aria-hidden="true">
          <span className={`relative flex-1 rounded-l-md ${c.body}`}>
            <span className={`absolute inset-x-2 top-1/4 h-1 rounded ${c.light}`} />
          </span>
          <svg viewBox="0 0 10 20" preserveAspectRatio="none" className="h-full w-2.5 shrink-0">
            <path d="M0 0 L10 6 L10 14 L0 20 Z" className={fillClass[colour]} />
          </svg>
        </span>
      );
    case "ribbon":
      return (
        <span className="flex h-full w-full items-center" aria-hidden="true">
          <span
            className={`block h-[70%] w-full rounded-sm ${c.body}`}
            style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 8px, rgba(255,255,255,.35) 8px 14px)" }}
          />
        </span>
      );
    case "straw":
      return (
        <span className="flex h-full w-full items-center" aria-hidden="true">
          <span
            className={`block h-[55%] w-full rounded-full ${c.body}`}
            style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 10px, rgba(255,255,255,.55) 10px 16px)" }}
          />
        </span>
      );
    case "sunflower":
      return (
        <span className="flex h-full w-full flex-col items-center" aria-hidden="true">
          <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0">
            {Array.from({ length: 10 }, (_, k) => (
              <ellipse key={k} cx="20" cy="9" rx="4.5" ry="8" transform={`rotate(${k * 36} 20 20)`} className={fillClass[colour]} />
            ))}
            <circle cx="20" cy="20" r="7" className="fill-stone-700" />
          </svg>
          <span className="w-1.5 flex-1 rounded-b bg-emerald-600" />
        </span>
      );
    case "candle":
      return (
        <span className="flex h-full w-full flex-col items-center" aria-hidden="true">
          <svg viewBox="0 0 16 22" className="h-5 w-4 shrink-0">
            <path d="M8 0 C12 8 14 12 8 22 C2 12 4 8 8 0 Z" className="fill-rose-500" />
            <path d="M8 8 C10 12 10 15 8 20 C6 15 6 12 8 8 Z" className="fill-orange-100" />
          </svg>
          <span className={`w-6 flex-1 rounded-t-sm ${c.body}`} />
        </span>
      );
    case "tower":
      return (
        <span
          className={`block h-full w-10 rounded-sm border-2 ${c.border} ${c.body}`}
          style={{ backgroundImage: "repeating-linear-gradient(180deg, transparent 0 22px, rgba(0,0,0,.25) 22px 24px)" }}
          aria-hidden="true"
        />
      );
    case "flag":
      return (
        <span className="relative flex h-full w-full justify-center" aria-hidden="true">
          <span className="h-full w-1.5 rounded bg-slate-500" />
          <span className={`absolute left-1/2 top-0 h-6 w-9 ${c.body}`} style={{ clipPath: "polygon(0 0, 100% 50%, 0 100%)" }} />
        </span>
      );
    case "door":
      return (
        <span className={`relative block h-full w-full rounded-t-md border-4 ${c.border} ${c.light}`} aria-hidden="true">
          <span className="absolute right-2 top-1/2 h-2.5 w-2.5 rounded-full bg-slate-700" />
        </span>
      );
    case "bookcase":
      return (
        <span
          className={`block h-full w-full rounded-sm border-4 ${c.border} ${c.light}`}
          style={{ backgroundImage: "repeating-linear-gradient(180deg, transparent 0 26px, rgba(0,0,0,.35) 26px 30px)" }}
          aria-hidden="true"
        />
      );
    case "window":
      return (
        <span className={`relative block h-full w-full rounded-sm border-4 ${c.border} bg-sky-100 dark:bg-sky-900/50`} aria-hidden="true">
          <span className={`absolute inset-y-0 left-1/2 w-1 ${c.body}`} />
          <span className={`absolute inset-x-0 top-1/2 h-1 ${c.body}`} />
        </span>
      );
    default:
      return (
        <span className={`relative block h-full w-full rounded-md border-4 ${c.border} ${c.light}`} aria-hidden="true">
          <span className={`absolute inset-y-1 left-1/2 w-0.5 ${c.body}`} />
          <span className="absolute left-[40%] top-1/2 h-2 w-1 rounded bg-slate-700" />
          <span className="absolute right-[40%] top-1/2 h-2 w-1 rounded bg-slate-700" />
        </span>
      );
  }
};
