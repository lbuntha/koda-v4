import React, { useState } from "react";
import {
  Bot,
  Check,
  Compass,
  LayoutGrid,
  Palette,
  PawPrint,
  PenTool,
  Smile,
  Star,
  UserRound,
} from "lucide-react";
import { KidAvatar } from "./KidAvatar";
import { cn } from "../lib/utils";
import { useSvgLibrary } from "../assets/SvgLibraryContext";
import { KODA_KID_AVATARS } from "./LearnerPortrait";

export interface AvatarCategory {
  id: string;
  label: string;
  /** A lucide icon component, matching how the sidebar and the rest of the app draw nav icons. */
  icon: React.ElementType;
  avatars: string[];
}

const DICEBEAR_BASE = "https://api.dicebear.com/7.x";

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  {
    id: "koda_kids",
    label: "Koda Kids",
    icon: Star,
    avatars: [...KODA_KID_AVATARS],
  },
  {
    id: "adventurer",
    label: "Adventurers",
    icon: Compass,
    avatars: [
      `${DICEBEAR_BASE}/adventurer/svg?seed=Felix`,
      `${DICEBEAR_BASE}/adventurer/svg?seed=Zoe`,
      `${DICEBEAR_BASE}/adventurer/svg?seed=Jack`,
      `${DICEBEAR_BASE}/adventurer/svg?seed=Maya`,
      `${DICEBEAR_BASE}/adventurer/svg?seed=Oliver`,
      `${DICEBEAR_BASE}/adventurer/svg?seed=Chloe`,
      `${DICEBEAR_BASE}/adventurer/svg?seed=Leo`,
      `${DICEBEAR_BASE}/adventurer/svg?seed=Aria`,
    ],
  },
  {
    id: "avataaars",
    label: "Avataaars",
    icon: UserRound,
    avatars: [
      `${DICEBEAR_BASE}/avataaars/svg?seed=Alexander`,
      `${DICEBEAR_BASE}/avataaars/svg?seed=Sophia`,
      `${DICEBEAR_BASE}/avataaars/svg?seed=Lucas`,
      `${DICEBEAR_BASE}/avataaars/svg?seed=Emma`,
      `${DICEBEAR_BASE}/avataaars/svg?seed=Mason`,
      `${DICEBEAR_BASE}/avataaars/svg?seed=Ava`,
      `${DICEBEAR_BASE}/avataaars/svg?seed=Ethan`,
      `${DICEBEAR_BASE}/avataaars/svg?seed=Isabella`,
    ],
  },
  {
    id: "bottts",
    label: "Robots",
    icon: Bot,
    avatars: [
      `${DICEBEAR_BASE}/bottts/svg?seed=Sparky`,
      `${DICEBEAR_BASE}/bottts/svg?seed=Gizmo`,
      `${DICEBEAR_BASE}/bottts/svg?seed=Volt`,
      `${DICEBEAR_BASE}/bottts/svg?seed=Circuit`,
      `${DICEBEAR_BASE}/bottts/svg?seed=Bytes`,
      `${DICEBEAR_BASE}/bottts/svg?seed=Pixel`,
      `${DICEBEAR_BASE}/bottts/svg?seed=Nano`,
      `${DICEBEAR_BASE}/bottts/svg?seed=Robo`,
    ],
  },
  {
    id: "emoji",
    label: "Fun Emoji",
    icon: Smile,
    avatars: [
      `${DICEBEAR_BASE}/fun-emoji/svg?seed=Happy`,
      `${DICEBEAR_BASE}/fun-emoji/svg?seed=Cool`,
      `${DICEBEAR_BASE}/fun-emoji/svg?seed=Star`,
      `${DICEBEAR_BASE}/fun-emoji/svg?seed=Wink`,
      `${DICEBEAR_BASE}/fun-emoji/svg?seed=Smile`,
      `${DICEBEAR_BASE}/fun-emoji/svg?seed=Hero`,
      `${DICEBEAR_BASE}/fun-emoji/svg?seed=Joy`,
      `${DICEBEAR_BASE}/fun-emoji/svg?seed=Chilly`,
    ],
  },
  {
    id: "lorelei",
    label: "Lorelei",
    icon: Palette,
    avatars: [
      `${DICEBEAR_BASE}/lorelei/svg?seed=Luna`,
      `${DICEBEAR_BASE}/lorelei/svg?seed=Milo`,
      `${DICEBEAR_BASE}/lorelei/svg?seed=Nora`,
      `${DICEBEAR_BASE}/lorelei/svg?seed=Caleb`,
      `${DICEBEAR_BASE}/lorelei/svg?seed=Hazel`,
      `${DICEBEAR_BASE}/lorelei/svg?seed=Eli`,
      `${DICEBEAR_BASE}/lorelei/svg?seed=Ivy`,
      `${DICEBEAR_BASE}/lorelei/svg?seed=Asher`,
    ],
  },
  {
    id: "wild",
    label: "Animals",
    icon: PawPrint,
    avatars: ["🦊", "🐼", "🐯", "🦁", "🐨", "🐻", "🐘", "🐵", "🐧", "🐳", "🐙", "🐬", "🦉", "🐝", "🐰", "🐮"],
  },
];

export const AVATARS = AVATAR_CATEGORIES.flatMap((c) => c.avatars);
export const AVATAR_FALLBACK = "🧒";

interface AvatarPickerProps {
  value: string | null;
  onChange: (avatar: string) => void;
  className?: string;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ value, onChange, className }) => {
  const [activeTab, setActiveTab] = useState<string>("koda_kids");

  let customSvgAvatars: string[] = [];
  try {
    const library = useSvgLibrary();
    customSvgAvatars = (library.assets || []).map((a) => a.markup).filter(Boolean);
  } catch {
    // Gracefully handle rendering when outside SvgLibraryProvider
  }

  const allCategories: AvatarCategory[] = [
    ...AVATAR_CATEGORIES,
    ...(customSvgAvatars.length > 0
      ? [
          {
            id: "custom_library",
            label: "Custom SVG Assets",
            icon: PenTool,
            avatars: customSvgAvatars,
          },
        ]
      : []),
  ];

  const allAvatars = [...AVATARS, ...customSvgAvatars];

  const displayedAvatars = activeTab === "all"
    ? allAvatars
    : (allCategories.find((c) => c.id === activeTab)?.avatars ?? allAvatars);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 dark:border-white/10 pb-2.5">
        {[{ id: "all", label: `All (${allAvatars.length})`, icon: LayoutGrid }, ...allCategories].map(
          ({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-indigo-600 text-white dark:bg-[#BEACFF] dark:text-[#191338]"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                )}
              >
                <Icon size={13} className="shrink-0" />
                <span>{label}</span>
              </button>
            );
          }
        )}
      </div>

      {/* Interactive Avatar Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-[240px] overflow-y-auto p-1 scrollbar-thin">
        {displayedAvatars.map((a, idx) => {
          const selected = value === a;
          return (
            <button
              key={`${a.slice(0, 30)}_${idx}`}
              type="button"
              onClick={() => onChange(a)}
              aria-label={`Select avatar ${idx + 1}`}
              className={cn(
                "group relative aspect-square rounded-2xl p-1.5 text-2xl flex items-center justify-center transition-all cursor-pointer overflow-hidden",
                selected
                  ? "bg-[#F0EBFF] ring-3 ring-[#5C46DF] shadow-md shadow-indigo-500/20 dark:bg-white/20 dark:ring-[#BEACFF]"
                  : "bg-slate-100/80 hover:bg-slate-200/80 hover:scale-105 dark:bg-white/5 dark:hover:bg-white/10"
              )}
            >
              <KidAvatar avatar={a} className="h-full w-full object-contain" />
              {selected && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#5C46DF] text-white shadow-sm ring-2 ring-white dark:bg-[#BEACFF] dark:text-[#191338]">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
