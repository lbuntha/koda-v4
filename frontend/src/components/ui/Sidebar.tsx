import React, { useState } from "react";
import { BarChart2, Palette, Layers, Settings, Maximize2, PenTool, BookOpen, GraduationCap, LogOut } from "lucide-react";
import { Button } from "./Button";
import { sounds } from "../../sound";
import { HowToAddGameModal } from "../HowToAddGameModal";
import { useAuth } from "../../auth/AuthContext";

interface SidebarProps {
  adminTab: string;
  setAdminTab: (tab: "dashboard" | "studio" | "assets" | "slides" | "presets" | "settings" | "curriculum") => void;
  onLaunchGame: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ adminTab, setAdminTab, onLaunchGame }) => {
  const { status, account, logout } = useAuth();
  const [showGuide, setShowGuide] = useState(false);

  const handleTabClick = (tabId: any) => {
    setAdminTab(tabId);
    sounds.playPop();
  };

  const navItems = [
    { id: "dashboard", label: "Classroom Dashboard", icon: BarChart2 },
    { id: "studio", label: "Interactive Studio", icon: Palette },
    { id: "assets", label: "Custom SVG Maker", icon: PenTool },
    { id: "slides", label: "Slides Deck Manager", icon: Layers },
    { id: "curriculum", label: "Curriculum Studio", icon: BookOpen },
    { id: "settings", label: "Studio & Sound Config", icon: Settings },
  ];

  return (
    <aside className="w-full md:w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 border-r border-slate-800">
      {/* Brand Profile header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-2.5 bg-slate-950/20">
        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-slate-900 font-extrabold text-base shadow-md">
          👑
        </div>
        <div>
          <h2 className="text-sm font-extrabold tracking-tight text-white leading-tight">Learn with Koda</h2>
          <span className="text-[10px] font-mono font-black text-amber-400 tracking-wider uppercase">Instructor Admin</span>
        </div>
      </div>

      {/* Admin Tabs list */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = adminTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <IconComponent size={14} className={isActive ? "text-white" : "text-slate-400"} />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Developer help — opens the "How to add a new game" guide */}
        <div className="pt-2 mt-2 border-t border-slate-800/60">
          <button
            onClick={() => {
              setShowGuide(true);
              sounds.playPop();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer text-slate-400 hover:bg-slate-800/60 hover:text-white"
          >
            <GraduationCap size={14} className="text-slate-400" />
            <span>How to Add a Game</span>
          </button>
        </div>
      </nav>

      <HowToAddGameModal isOpen={showGuide} onClose={() => setShowGuide(false)} />

      {/* Sidebar Bottom Action: Launch Student Game */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-2">
        <Button
          onClick={onLaunchGame}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow flex items-center justify-center gap-2 cursor-pointer border-0"
        >
          <Maximize2 size={13} />
          Launch Student Game
        </Button>
        {status === "authenticated" && account && (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all cursor-pointer"
            title={`Signed in as ${account.name}`}
          >
            <LogOut size={12} />
            Sign out ({account.name})
          </button>
        )}
      </div>
    </aside>
  );
};
