/**
 * Who a player can be: a nickname and an avatar from fixed lists.
 *
 * Mirrors `server/app/rebus_room.py`, which is what actually enforces it. The
 * lists are here so the screen can be drawn before (or without) the server
 * answering `GET /rebus/rooms/choices`. A nickname is stored in English and
 * shown in the viewer's own language.
 */

import { Bird, Cat, Dog, Fish, PawPrint, Rabbit, Squirrel, type LucideIcon } from "lucide-react";

export const NICKNAMES: readonly string[] = [
  "Brave Tiger", "Clever Fox", "Happy Panda", "Swift Falcon", "Quiet Owl", "Bright Dolphin",
  "Kind Elephant", "Bold Lion", "Gentle Deer", "Lucky Rabbit", "Mighty Bear", "Silly Monkey",
  "Sunny Parrot", "Cool Turtle", "Speedy Cheetah", "Proud Peacock", "Jolly Frog", "Wise Crane",
  "Sparkly Otter", "Zippy Koala", "Calm Whale", "Cheery Robin", "Daring Eagle", "Merry Penguin",
];

export const AVATARS: readonly string[] = ["tiger", "fox", "panda", "falcon", "owl", "dolphin", "elephant", "lion", "deer", "rabbit", "bear", "monkey"];

/** A picture and a colour for each avatar. Colours avoid yellow throughout Koda. */
export const AVATAR_LOOK: Readonly<Record<string, { icon: LucideIcon; tone: string }>> = {
  tiger: { icon: Cat, tone: "bg-indigo-500" },
  fox: { icon: Dog, tone: "bg-pink-500" },
  panda: { icon: PawPrint, tone: "bg-slate-700" },
  falcon: { icon: Bird, tone: "bg-cyan-600" },
  owl: { icon: Bird, tone: "bg-purple-500" },
  dolphin: { icon: Fish, tone: "bg-cyan-500" },
  elephant: { icon: PawPrint, tone: "bg-emerald-600" },
  lion: { icon: Cat, tone: "bg-rose-500" },
  deer: { icon: Squirrel, tone: "bg-emerald-500" },
  rabbit: { icon: Rabbit, tone: "bg-pink-400" },
  bear: { icon: PawPrint, tone: "bg-indigo-600" },
  monkey: { icon: Squirrel, tone: "bg-purple-600" },
};

/** The key a nickname has in the language files: "Brave Tiger" is `brave-tiger`. */
export const nicknameKey = (name: string): string => name.toLowerCase().replace(/[^a-z]+/g, "-");

/** Short, readable, and the same wherever it is shown. */
export const formatCode = (code: string): string => `${code.slice(0, 3)} ${code.slice(3)}`;
