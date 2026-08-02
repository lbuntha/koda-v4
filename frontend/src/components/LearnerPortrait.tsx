import React from "react";
import { cn } from "../lib/utils";

/** The portrait art comes in these variants, so the type lives with the art rather
 *  than in the parent onboarding wizard that also happens to collect it. */
export type LearnerGender = "boy" | "girl" | null;

export const KODA_KID_AVATARS = [
  "koda-kid:boy-sky",
  "koda-kid:boy-mint",
  "koda-kid:boy-sun",
  "koda-kid:boy-violet",
  "koda-kid:girl-rose",
  "koda-kid:girl-mint",
  "koda-kid:girl-sun",
  "koda-kid:girl-violet",
] as const;

export type KodaKidAvatarId = typeof KODA_KID_AVATARS[number];

const AVATAR_STYLES: Record<KodaKidAvatarId, {
  gender: Exclude<LearnerGender, null>;
  background: [string, string];
  shirt: string;
  skin: string;
  shadow: string;
  hair: string;
  accent: string;
}> = {
  "koda-kid:boy-sky": { gender: "boy", background: ["#DDF2FF", "#BBD9FF"], shirt: "#4B8EF1", skin: "#F2B58C", shadow: "#D99368", hair: "#33465F", accent: "#FFFFFF" },
  "koda-kid:boy-mint": { gender: "boy", background: ["#DDF9EC", "#AEE9D2"], shirt: "#24AD82", skin: "#B9744F", shadow: "#96583B", hair: "#292A35", accent: "#D9FFF3" },
  "koda-kid:boy-sun": { gender: "boy", background: ["#FFF3C8", "#FFD98B"], shirt: "#F19B38", skin: "#F0C09A", shadow: "#D99A70", hair: "#744C2E", accent: "#FFF4D6" },
  "koda-kid:boy-violet": { gender: "boy", background: ["#EEE7FF", "#CFBEFF"], shirt: "#7356D9", skin: "#8E563D", shadow: "#74412E", hair: "#251E2D", accent: "#EDE7FF" },
  "koda-kid:girl-rose": { gender: "girl", background: ["#FFE4F1", "#FFC7E2"], shirt: "#EF6CA5", skin: "#F2B58C", shadow: "#D99368", hair: "#513343", accent: "#FF8BB8" },
  "koda-kid:girl-mint": { gender: "girl", background: ["#DDF9EC", "#AEE9D2"], shirt: "#24AD82", skin: "#B9744F", shadow: "#96583B", hair: "#2D262B", accent: "#6FE0BD" },
  "koda-kid:girl-sun": { gender: "girl", background: ["#FFF3C8", "#FFD98B"], shirt: "#F19B38", skin: "#F0C09A", shadow: "#D99A70", hair: "#8A552F", accent: "#FFC94C" },
  "koda-kid:girl-violet": { gender: "girl", background: ["#EEE7FF", "#CFBEFF"], shirt: "#7356D9", skin: "#8E563D", shadow: "#74412E", hair: "#241D2A", accent: "#BCA5FF" },
};

export const isKodaKidAvatar = (avatar: string): avatar is KodaKidAvatarId => KODA_KID_AVATARS.includes(avatar as KodaKidAvatarId);

interface Props {
  variant?: Exclude<LearnerGender, null>;
  avatarId?: KodaKidAvatarId;
  className?: string;
}

export const LearnerPortrait: React.FC<Props> = ({ variant = "boy", avatarId, className }) => {
  const style = AVATAR_STYLES[avatarId ?? (variant === "boy" ? "koda-kid:boy-sky" : "koda-kid:girl-rose")];
  const isBoy = style.gender === "boy";
  const gradientId = React.useId().replace(/:/g, "");

  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={isBoy ? "Smiling boy" : "Smiling girl"} className={cn("h-full w-full", className)}>
      <defs>
        <linearGradient id={gradientId} x1="18" y1="10" x2="105" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor={style.background[0]} />
          <stop offset="1" stopColor={style.background[1]} />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="60" fill={`url(#${gradientId})`} />

      {!isBoy && (
        <>
          <circle cx="25" cy="54" r="17" fill={style.hair} />
          <circle cx="95" cy="54" r="17" fill={style.hair} />
          <circle cx="22" cy="53" r="7" fill={style.accent} />
          <circle cx="98" cy="53" r="7" fill={style.accent} />
        </>
      )}

      <path d="M22 120c3-23 18-34 38-34s35 11 38 34Z" fill={style.shirt} />
      <path d="M48 82h24v18c-7 6-17 6-24 0Z" fill={style.shadow} />
      <circle cx="32" cy="58" r="10" fill={style.shadow} />
      <circle cx="88" cy="58" r="10" fill={style.shadow} />
      <ellipse cx="60" cy="57" rx="32" ry="38" fill={style.skin} />

      {isBoy ? (
        <path d="M29 49c0-23 15-36 34-36 17 0 30 10 32 29-8-8-16-12-24-14-9 9-22 15-42 17Z" fill={style.hair} />
      ) : (
        <>
          <path d="M27 52c-2-25 11-40 34-40 22 0 35 15 32 42-5-12-12-20-21-25-9 9-22 15-45 18Z" fill={style.hair} />
          <path d="M29 45c-3 23 1 37 9 49-13-7-19-23-15-43Z" fill={style.hair} />
          <path d="M91 45c3 23-1 37-9 49 13-7 19-23 15-43Z" fill={style.hair} />
        </>
      )}

      <path d="M39 53c5-4 10-4 15 0M66 53c5-4 10-4 15 0" fill="none" stroke="#4B3040" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="47" cy="61" rx="7" ry="8" fill="#FFF" />
      <ellipse cx="73" cy="61" rx="7" ry="8" fill="#FFF" />
      <circle cx="48" cy="62" r="3.5" fill="#29364D" />
      <circle cx="72" cy="62" r="3.5" fill="#29364D" />
      <circle cx="49" cy="61" r="1.2" fill="#FFF" />
      <circle cx="73" cy="61" r="1.2" fill="#FFF" />
      <ellipse cx="39" cy="73" rx="6" ry="3" fill="#EB7E89" opacity=".5" />
      <ellipse cx="81" cy="73" rx="6" ry="3" fill="#EB7E89" opacity=".5" />
      <path d="M50 77c5 7 15 7 20 0" fill="#FFF" stroke="#7D3D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M42 102c10 7 26 7 36 0" fill="none" stroke={style.accent} strokeWidth="3" strokeLinecap="round" opacity=".8" />
    </svg>
  );
};
