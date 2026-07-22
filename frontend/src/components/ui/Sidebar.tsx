import React, { useState } from "react";
import { BarChart2, Palette, Layers, Settings, Maximize2, PenTool, Key, Eye, EyeOff, BookOpen, GraduationCap } from "lucide-react";
import { Button } from "./Button";
import { sounds } from "../../sound";
import { getStoredApiKey, setStoredApiKey, getStoredModel, setStoredModel } from "../studio/ai-generator/openaiService";
import { HowToAddGameModal } from "../HowToAddGameModal";

interface SidebarProps {
  adminTab: string;
  setAdminTab: (tab: "dashboard" | "studio" | "assets" | "slides" | "presets" | "settings" | "curriculum") => void;
  onLaunchGame: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ adminTab, setAdminTab, onLaunchGame }) => {
  const [apiKey, setApiKey] = useState<string>(getStoredApiKey());
  const [model, setModel] = useState<string>(getStoredModel());
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const handleTabClick = (tabId: any) => {
    setAdminTab(tabId);
    sounds.playPop();
  };

  React.useEffect(() => {
    const handleKeySync = () => {
      setApiKey(getStoredApiKey());
      setModel(getStoredModel());
    };
    window.addEventListener("koda-apikey-changed", handleKeySync);
    return () => {
      window.removeEventListener("koda-apikey-changed", handleKeySync);
    };
  }, []);

  const handleSaveKey = () => {
    setStoredApiKey(apiKey);
    setIsSaved(true);
    sounds.playPop();
    setTimeout(() => setIsSaved(false), 1500);
    // Dispatch a custom event to sync states if needed, or simply reload local state
    window.dispatchEvent(new Event("koda-apikey-changed"));
  };

  const handleSetModel = (selectedModel: string) => {
    setStoredModel(selectedModel);
    setModel(selectedModel);
    sounds.playPop();
    window.dispatchEvent(new Event("koda-apikey-changed"));
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

      {/* OpenAI API Key Panel */}
      <div className="mx-4 mb-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 space-y-2 text-left animate-fade-in">
        <div className="flex items-center gap-1.5">
          <Key size={12} className="text-indigo-400" />
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">OpenAI API Key</span>
          {apiKey.trim() && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Key set" />
          )}
        </div>
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-slate-900/90 border border-slate-700/80 text-slate-100 text-[10px] px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 font-mono transition-colors"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350"
            >
              {showKey ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          </div>
          <button
            onClick={handleSaveKey}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          >
            {isSaved ? "Saved" : "Save"}
          </button>
        </div>

        {/* Model dropdown */}
        <div className="space-y-1 pt-1 border-t border-slate-800/40">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">AI Model Selection</span>
          <select
            value={model}
            onChange={(e) => handleSetModel(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-[10px] px-2 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 font-medium cursor-pointer"
          >
            <option value="gpt-4o-mini">GPT-4o Mini (Fast & Smart)</option>
            <option value="gpt-4o">GPT-4o (High Intelligence)</option>
            <option value="o1-mini">o1 Mini (Reasoning Preview)</option>
          </select>
        </div>
      </div>

      {/* Sidebar Bottom Action: Launch Student Game */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <Button
          onClick={onLaunchGame}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow flex items-center justify-center gap-2 cursor-pointer border-0"
        >
          <Maximize2 size={13} />
          Launch Student Game
        </Button>
      </div>
    </aside>
  );
};
