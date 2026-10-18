import React from "react";
import { PawPrint } from "lucide-react";
import { AVATAR_LOOK } from "./choices";

/** A player's picture: their avatar's animal on its own colour. */
export const RoomAvatar: React.FC<{ avatar: string; size?: "md" | "lg" }> = ({ avatar, size = "md" }) => {
  const look = AVATAR_LOOK[avatar] ?? { icon: PawPrint, tone: "bg-indigo-500" };
  const Icon = look.icon;
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full text-white ${look.tone} ${size === "lg" ? "h-14 w-14 [&>svg]:h-7 [&>svg]:w-7" : "h-10 w-10 [&>svg]:h-5 [&>svg]:w-5"}`}>
      <Icon />
    </span>
  );
};
