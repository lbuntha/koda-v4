import React, { useState } from "react";
import { Check } from "lucide-react";
import { KidAvatar } from "../components/KidAvatar";
import { cn } from "../lib/utils";
import { useSvgLibrary } from "../assets/SvgLibraryContext";

export interface AvatarCategory {
  id: string;
  label: string;
  icon: string;
  avatars: string[];
}

const DICEBEAR_BASE = "https://api.dicebear.com/7.x";

export const LEARNER_PROFILE_IMAGES = {
  boy: `${DICEBEAR_BASE}/adventurer/svg?seed=Felix`,
  girl: `${DICEBEAR_BASE}/adventurer/svg?seed=Zoe`,
} as const;

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  {
    id: "adventurer",
    label: "Adventurers",
    icon: "✨",
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
    icon: "🧑",
    avatars: [
      LEARNER_PROFILE_IMAGES.boy,
      LEARNER_PROFILE_IMAGES.girl,
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
    icon: "🤖",
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
    icon: "😄",
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
    icon: "🎨",
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
    icon: "🐾",
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
  const [activeTab, setActiveTab] = useState<string>("adventurer");

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
            icon: "⭐",
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
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`rounded-full px-3 py-1 text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === "all"
              ? "bg-[#5C46DF] text-white shadow-md shadow-indigo-500/20 dark:bg-[#BEACFF] dark:text-[#191338]"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          }`}
        >
          All ({allAvatars.length})
        </button>
        {allCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveTab(cat.id)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === cat.id
                ? "bg-[#5C46DF] text-white shadow-md shadow-indigo-500/20 dark:bg-[#BEACFF] dark:text-[#191338]"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
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
