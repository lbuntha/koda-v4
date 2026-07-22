/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { CountingQuestion, CountingTechnique, COUNT_OBJECTS, SVG_OBJECTS, EMOJI_OBJECTS, CUSTOM_SVG_OBJECT_PLACEHOLDER, CustomSvgAsset } from "./types";
import { CountingAsset, SVG_OVERRIDES_CACHE } from "./components/Assets";
import { SvgDesigner } from "./components/SvgDesigner";
import { DEFAULT_QUESTIONS } from "./templates";
import { sounds } from "./sound";
import { OneToOneCanvas } from "./components/canvases/OneToOneCanvas";
import { LazyBoundary } from "./components/LazyBoundary";
import {
  Sparkles,
  Gamepad2,
  Settings,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  RotateCcw,
  Check,
  Play,
  Maximize2,
  Minimize2,
  ArrowRight,
  Sparkle,
  Layers,
  CheckCircle,
  HelpCircle,
  Undo,
  Palette,
  Grid,
  Link,
  Crown,
  Users,
  BarChart2,
  PlusCircle,
  ArrowDown,
  ArrowUp,
  ZoomIn,
  Fingerprint,
  ArrowRightLeft,
  ListOrdered,
  Boxes,
  MinusCircle,
  LayoutGrid,
  Magnet,
  Eye,
  PlusSquare,
  MinusSquare,
  Hash,
  Workflow,
  Sliders,
  Edit3,
  Smile,
  Wand2
} from "lucide-react";
import { UIPaletteLab } from "./components/UIPaletteLab";
import { GameLauncher } from "./components/GameLauncher";
import { CurriculumStudioPage } from "./components/curriculum/CurriculumStudioPage";
import { TECHNIQUE_PANELS } from "./components/studio/panels";
import { TECHNIQUE_OPTIONS, defaultTargetCountForTechnique } from "./components/studio/techniqueOptions";
import { CANVAS_BY_TECHNIQUE } from "./components/studio/canvasRegistry";
import { AiGeneratorPanel } from "./components/studio/ai-generator";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Label,
  Textarea,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  Badge,
  Sidebar
} from "./components/ui";

// Confetti Particle Interface
interface ConfettiParticle {
  id: number;
  left: string;
  color: string;
  delay: string;
  size: string;
}

export default function App() {
  const [questions, setQuestions] = useState<CountingQuestion[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isPlayMode, setIsPlayMode] = useState<boolean>(true); // default to play mode so it's instantly interactive
  const [adminTab, setAdminTab] = useState<"dashboard" | "studio" | "assets" | "slides" | "presets" | "settings" | "curriculum">("dashboard");
  const [students, setStudents] = useState([
    { id: "s1", name: "Noah S.", progress: "14/15 solved", activeId: "q-pattern", speed: "Fast", status: "Active" },
    { id: "s2", name: "Sophia K.", progress: "15/15 completed", activeId: "q-flexible-sorting", speed: "Super Fast", status: "Done" },
    { id: "s3", name: "Jackson R.", progress: "10/15 solved", activeId: "q-addition", speed: "Normal", status: "Active" },
    { id: "s4", name: "Emily D.", progress: "4/15 solved", activeId: "q-group-tens", speed: "Needs Help", status: "Stuck" }
  ]);
  const [isGameLaunched, setIsGameLaunched] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("mode") === "game" || params.get("game") === "true";
    }
    return false;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [localHeight, setLocalHeight] = useState<number | null>(null);
  const [localWidth, setLocalWidth] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activePropTab, setActivePropTab] = useState<"visual" | "design" | "component" | "json" | "ai">("visual");
  const [jsonInput, setJsonInput] = useState<string>("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPaletteLabOpen, setIsPaletteLabOpen] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [isPropStudioCollapsed, setIsPropStudioCollapsed] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(100);
  const [isTabChanging, setIsTabChanging] = useState<boolean>(false);
  const [customSvgs, setCustomSvgs] = useState<CustomSvgAsset[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("koda_custom_svg_assets");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [svgOverrides, setSvgOverrides] = useState<Record<string, { markup: string; scale: number }>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("koda_svg_overrides");
      try {
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  useEffect(() => {
    SVG_OVERRIDES_CACHE.overrides = svgOverrides;
  }, [svgOverrides]);

  // Find active question
  const activeQuestion = questions.find(q => q.id === activeId) || questions[0];

  useEffect(() => {
    if (activeQuestion?.config?.assetType === "custom_svg") {
      CUSTOM_SVG_OBJECT_PLACEHOLDER.emoji = activeQuestion.config.customSvgMarkup || "";
      CUSTOM_SVG_OBJECT_PLACEHOLDER.label = activeQuestion.config.customSvgLabel || "Custom Shape";
      CUSTOM_SVG_OBJECT_PLACEHOLDER.scale = activeQuestion.config.customSvgScale || 1.0;
    }
  }, [activeId, activeQuestion?.config?.assetType, activeQuestion?.config?.customSvgMarkup, activeQuestion?.config?.customSvgLabel, activeQuestion?.config?.customSvgScale]);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error("Error entering fullscreen:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Guarantee Student Play Mode on Mobile Viewports (Design Mode is optimized for Tablet/Desktop display authoring)
  useEffect(() => {
    const checkMobileMode = () => {
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setIsPlayMode(true);
      }
    };
    checkMobileMode();
    window.addEventListener("resize", checkMobileMode);
    return () => window.removeEventListener("resize", checkMobileMode);
  }, []);
  // Reset success state on active id changes
  useEffect(() => {
    setIsSuccess(false);
    setConfetti([]);
  }, [activeId]);

  // Live Sync activeQuestion to jsonInput
  useEffect(() => {
    if (activeQuestion) {
      setJsonInput(JSON.stringify(activeQuestion, null, 2));
      setJsonError(null);
    }
  }, [
    activeId,
    activeQuestion?.title,
    activeQuestion?.instruction,
    activeQuestion?.technique,
    activeQuestion?.targetCount,
    activeQuestion?.objectId,
    JSON.stringify(activeQuestion?.config)
  ]);

  const handleJsonChange = (val: string) => {
    setJsonInput(val);
    try {
      const parsed = JSON.parse(val) as CountingQuestion;
      if (!parsed.id || !parsed.title || !parsed.technique) {
        setJsonError("JSON schema must contain fields: 'id', 'title', and 'technique'.");
        return;
      }
      setJsonError(null);
      const updatedQuestions = questions.map(q => q.id === parsed.id ? parsed : q);
      setQuestions(updatedQuestions);
      localStorage.setItem("counting_studio_questions", JSON.stringify(updatedQuestions));
    } catch (err: any) {
      setJsonError(err.message || "Invalid JSON syntax");
    }
  };

  // Initialize and load from local storage
  useEffect(() => {
    const stored = localStorage.getItem("counting_studio_questions");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CountingQuestion[];
        if (parsed.length > 0) {
          setQuestions(parsed);
          setActiveId(parsed[0].id);
          return;
        }
      } catch (e) {
        console.error("Failed to parse stored questions:", e);
      }
    }
    // Fallback to default templates
    setQuestions(DEFAULT_QUESTIONS);
    setActiveId(DEFAULT_QUESTIONS[0].id);
  }, []);

  // Save to local storage whenever questions change
  const saveQuestions = (newQuestions: CountingQuestion[]) => {
    setQuestions(newQuestions);
    localStorage.setItem("counting_studio_questions", JSON.stringify(newQuestions));
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 2000);
  };

  const storedHeight = activeQuestion?.config?.workspaceHeight;
  const defaultHeight = (storedHeight && storedHeight > 340) ? storedHeight : 540;
  const workspaceHeight = localHeight !== null ? localHeight : defaultHeight;
  const workspaceWidth = localWidth !== null ? localWidth : activeQuestion?.config?.workspaceWidth;

  // Success Handler
  const handleSuccess = () => {
    setIsSuccess(true);
    triggerConfetti();
    sounds.playWin();
  };

  // Trigger CSS-based floating particles confetti
  const triggerConfetti = () => {
    const colors = [
      "bg-red-400", "bg-amber-400", "bg-pink-400", "bg-emerald-400", 
      "bg-indigo-400", "bg-sky-400", "bg-yellow-400", "bg-teal-400"
    ];
    const particles: ConfettiParticle[] = Array.from({ length: 60 }).map((_, idx) => ({
      id: Date.now() + idx,
      left: `${Math.random() * 100}%`,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: `${Math.random() * 1.8}s`,
      size: `${8 + Math.random() * 12}px`
    }));
    setConfetti(particles);
  };

  // Clear confetti after animation completes
  useEffect(() => {
    if (confetti.length > 0) {
      const timer = setTimeout(() => {
        setConfetti([]);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [confetti]);

  // Audio mute/unmute control
  const toggleMute = () => {
    const mutedState = !isMuted;
    setIsMuted(mutedState);
    sounds.setEnabled(!mutedState);
    sounds.playPop();
  };

  // Reset current slide or successful state
  const resetSlide = () => {
    setIsSuccess(false);
    setConfetti([]);
    sounds.playPop();
    // Force canvas re-renders
    const currentId = activeId;
    setActiveId("");
    setTimeout(() => setActiveId(currentId), 30);
  };

  // Add a new blank question
  const addNewQuestion = () => {
    sounds.playPop();
    const newId = `q-${Date.now()}`;
    const newQ: CountingQuestion = {
      id: newId,
      technique: CountingTechnique.ONE_TO_ONE,
      title: "Custom Counting Question",
      instruction: "Tap each item to count them up!",
      objectId: "apple",
      targetCount: 5,
      config: {}
    };
    const updated = [...questions, newQ];
    saveQuestions(updated);
    setActiveId(newId);
    setIsSuccess(false);
  };

  // Add multiple slides to the deck (used by AI Generator)
  const addSlides = (newSlides: CountingQuestion[]) => {
    if (newSlides.length === 0) return;
    const activeIdx = questions.findIndex(q => q.id === activeId);
    const updated = [...questions];
    updated.splice(activeIdx + 1, 0, ...newSlides);
    saveQuestions(updated);
  };

  // Duplicate active question
  const duplicateActive = () => {
    if (!activeQuestion) return;
    sounds.playPop();
    const newId = `q-dup-${Date.now()}`;
    const newQ: CountingQuestion = {
      ...activeQuestion,
      id: newId,
      title: `${activeQuestion.title} (Copy)`,
      config: { ...activeQuestion.config }
    };
    const activeIdx = questions.findIndex(q => q.id === activeId);
    const updated = [...questions];
    updated.splice(activeIdx + 1, 0, newQ);
    saveQuestions(updated);
    setActiveId(newId);
    setIsSuccess(false);
  };

  // Delete active question
  const deleteActive = () => {
    if (questions.length <= 1) return; // keep at least one
    sounds.playFailure();
    const activeIdx = questions.findIndex(q => q.id === activeId);
    const updated = questions.filter(q => q.id !== activeId);
    saveQuestions(updated);
    
    // Select next logical question
    const nextIdx = activeIdx === 0 ? 0 : activeIdx - 1;
    setActiveId(updated[nextIdx].id);
    setIsSuccess(false);
  };

  // Reorder worksheet deck (slide up/down)
  const moveQuestion = (direction: "up" | "down") => {
    const idx = questions.findIndex(q => q.id === activeId);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === questions.length - 1) return;

    sounds.playSlide();
    const updated = [...questions];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    
    const temp = updated[idx];
    updated[idx] = updated[swapIdx];
    updated[swapIdx] = temp;

    saveQuestions(updated);
    setIsSuccess(false);
  };

  // Reset to original 9 standard templates
  const restoreDefaults = () => {
    if (window.confirm("Restore standard worksheet templates? This will overwrite your current worksheet questions.")) {
      sounds.playSuccess();
      saveQuestions(DEFAULT_QUESTIONS);
      setActiveId(DEFAULT_QUESTIONS[0].id);
      setIsSuccess(false);
    }
  };

  // Update specific field on the active question
  const updateActiveQuestion = (fields: Partial<CountingQuestion>) => {
    const updated = questions.map(q => {
      if (q.id !== activeId) return q;
      const updatedQ = { ...q, ...fields } as CountingQuestion;

      // Handle self-consistent adjustments for specific techniques when counts change
      if (fields.targetCount !== undefined) {
        const count = fields.targetCount;
        updatedQ.config.customPositions = []; // Clear custom positions so it snaps to default layout
        if (updatedQ.technique === CountingTechnique.GROUP_IN_TENS) {
          updatedQ.config.baseCount = Math.min(10, count);
          updatedQ.config.extraCount = Math.max(0, count - 10);
        } else if (updatedQ.technique === CountingTechnique.COUNT_ON) {
          // base counts stays 5, extras are target - 5
          const base = updatedQ.config.baseCount || 5;
          updatedQ.config.extraCount = Math.max(1, count - base);
          updatedQ.targetCount = base + updatedQ.config.extraCount;
        } else if (updatedQ.technique === CountingTechnique.COUNT_BACK) {
          const rem = updatedQ.config.removeCount || 3;
          updatedQ.config.totalCount = count + rem;
        }
      }
      return updatedQ;
    });

    saveQuestions(updated);
    setIsSuccess(false); // reset successful state as design changed
  };


  // Resize handler for resizing workspace during design phase
  const isResizingRef = useRef(false);
  const resizeAxisRef = useRef<"width" | "height" | "both">("height");
  const workspaceWrapperRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startWidthRef = useRef(0);
  const startHeightRef = useRef(320);
  const currentWidthRef = useRef(0);
  const currentHeightRef = useRef(320);

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, axis: "width" | "height" | "both" = "height") => {
    e.preventDefault();
    isResizingRef.current = true;
    resizeAxisRef.current = axis;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startXRef.current = clientX;
    startYRef.current = clientY;
    startWidthRef.current = localWidth !== null ? localWidth : (activeQuestion?.config?.workspaceWidth || workspaceWrapperRef.current?.getBoundingClientRect().width || 720);
    const storedH = activeQuestion?.config?.workspaceHeight;
    const defaultH = (storedH && storedH > 340) ? storedH : 540;
    startHeightRef.current = localHeight !== null ? localHeight : defaultH;
    currentWidthRef.current = startWidthRef.current;
    currentHeightRef.current = startHeightRef.current;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!isResizingRef.current) return;
      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaX = currentX - startXRef.current;
      const deltaY = currentY - startYRef.current;
      if (resizeAxisRef.current === "width" || resizeAxisRef.current === "both") {
        const nextWidth = Math.max(360, Math.min(1400, startWidthRef.current + deltaX));
        currentWidthRef.current = Math.round(nextWidth);
        setLocalWidth(currentWidthRef.current);
      }
      if (resizeAxisRef.current === "height" || resizeAxisRef.current === "both") {
        const nextHeight = Math.max(240, Math.min(600, startHeightRef.current + deltaY));
        currentHeightRef.current = Math.round(nextHeight);
        setLocalHeight(currentHeightRef.current);
      }
    };

    const onEnd = (endEvent: MouseEvent | TouchEvent) => {
      isResizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);

      // Save to question config
      const finalWidth = currentWidthRef.current || startWidthRef.current;
      const finalHeight = currentHeightRef.current || startHeightRef.current;
      if (activeQuestion) {
        updateActiveQuestion({
          config: {
            ...activeQuestion.config,
            ...(resizeAxisRef.current === "width" || resizeAxisRef.current === "both" ? { workspaceWidth: finalWidth } : {}),
            ...(resizeAxisRef.current === "height" || resizeAxisRef.current === "both" ? { workspaceHeight: finalHeight } : {})
          }
        });
      }
      setLocalWidth(() => null);
      setLocalHeight(() => {
        return null;
      });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  };

  // Navigating slides in launched/fullscreen child mode
  const handleNextSlide = () => {
    setIsSuccess(false);
    const idx = questions.findIndex(q => q.id === activeId);
    if (idx < questions.length - 1) {
      setActiveId(questions[idx + 1].id);
      sounds.playPop();
    } else {
      // Completed last card
      sounds.playSuccess();
      setIsGameLaunched(false);
    }
  };

  const handlePrevSlide = () => {
    setIsSuccess(false);
    const idx = questions.findIndex(q => q.id === activeId);
    if (idx > 0) {
      setActiveId(questions[idx - 1].id);
      sounds.playPop();
    }
  };

  // Renders the specific interactive canvas
  const renderCanvas = () => {
    if (!activeQuestion) return null;

    const canvasProps = {
      question: activeQuestion,
      isPlayMode,
      showGrid,
      onSuccess: handleSuccess,
      onUpdateQuestionConfig: (newConfig: any) => {
        updateActiveQuestion({
          config: {
            ...activeQuestion.config,
            ...newConfig
          }
        });
      }
    };

    const Canvas = CANVAS_BY_TECHNIQUE[activeQuestion.technique] || OneToOneCanvas;
    return (
      <LazyBoundary>
        <Canvas key={activeQuestion.id} {...canvasProps} />
      </LazyBoundary>
    );
  };

  const currentIdx = questions.findIndex(q => q.id === activeId);

  // --- MODULE-BASED LAUNCH GAME PLAY VIEW ---
  if (isGameLaunched) {
    return (
      <GameLauncher
        questions={questions}
        activeId={activeId}
        setActiveId={setActiveId}
        onClose={() => {
          setIsGameLaunched(false);
          setIsSuccess(false);
        }}
      />
    );
  }

  // --- MAIN DASHBOARD / STUDIO LAYOUT ---
  return (
    <div className="md:h-screen flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">

      {/* Main Studio Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white shrink-0 shadow-sm shadow-indigo-600/10">
            <Layers size={18} className="text-white" />
          </div>
          <h1 className="text-base md:text-lg font-semibold tracking-tight text-slate-800">
            Learn with Koda <span className="text-slate-400 font-normal">/ Math Worksheet Builder</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-500 ${
            isSaving 
              ? "bg-amber-50 text-amber-600 border border-amber-200" 
              : "bg-emerald-50 text-emerald-600 border border-emerald-100"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isSaving ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
            {isSaving ? "Saving Workspace..." : "Worksheet Saved"}
          </div>
          <div className="hidden md:block h-6 w-px bg-slate-200 mx-1"></div>
          
          <Button
            onClick={restoreDefaults}
            variant="outline"
            size="sm"
            title="Restore standard 9 templates"
          >
            <RotateCcw size={12} />
            <span className="hidden sm:inline">Reset Workspace</span>
          </Button>

          <Button
            onClick={toggleMute}
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
            title={isMuted ? "Unmute sound" : "Mute sound"}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </Button>

          <Button
            onClick={() => {
              setIsPaletteLabOpen(true);
              sounds.playPop();
            }}
            variant="outline"
            size="sm"
            className="border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100/70 hover:text-indigo-800 font-bold flex items-center gap-1.5"
            title="Open UI & Palette Lab Guide"
          >
            <Palette size={13} className="text-indigo-600" />
            <span className="hidden sm:inline">UI & Palette Lab</span>
          </Button>

          <Button
            onClick={() => {
              const studentUrl = `${window.location.origin}${window.location.pathname}?mode=game`;
              navigator.clipboard.writeText(studentUrl).then(() => {
                setCopied(true);
                sounds.playSuccess();
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            variant="outline"
            size="sm"
            className="border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100/70 hover:text-indigo-800 font-bold flex items-center gap-1.5"
            title="Copy direct play link for students"
          >
            <Link size={12} className={copied ? "text-emerald-500" : "text-indigo-600"} />
            <span>{copied ? "Link Copied!" : "Copy Student Link"}</span>
          </Button>

          <Button
            onClick={() => {
              setIsGameLaunched(true);
              setIsSuccess(false);
              sounds.playSuccess();
            }}
            size="sm"
          >
            <Maximize2 size={12} />
            Launch Game
          </Button>
        </div>
      </header>

      {/* Main Studio Workspace columns layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-slate-50">
        {/* LEFT SIDEBAR: Admin Navigation */}
        <Sidebar
          adminTab={adminTab}
          setAdminTab={(tab) => {
            setIsTabChanging(true);
            setTimeout(() => {
              setAdminTab(tab);
              setIsTabChanging(false);
            }, 300);
          }}
          onLaunchGame={() => {
            setIsGameLaunched(true);
            setIsSuccess(false);
            sounds.playSuccess();
          }}
        />

          {/* MAIN CONTAINER FOR ADMIN CONTENT */}
          <div className={`flex-1 flex flex-col overflow-hidden bg-slate-100/60 ${adminTab === "studio" ? "p-0" : "p-6"}`}>
            {isTabChanging ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 font-sans select-none bg-slate-50/50">
                <div className="bg-white border border-slate-200/80 p-8 rounded-3xl shadow-xl flex flex-col items-center gap-5 text-center max-w-sm">
                  {/* Glowing Spinner */}
                  <div className="relative w-16 h-16">
                    {/* Ring background */}
                    <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                    {/* Gradient Spinning Ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-t-indigo-650 border-r-indigo-400 border-b-transparent border-l-transparent animate-spin" />
                    {/* Center Icon Pulse */}
                    <div className="absolute inset-3.5 bg-indigo-50 border border-indigo-150 rounded-full flex items-center justify-center animate-pulse">
                      <Sparkles size={16} className="text-indigo-600 animate-pulse" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-slate-800 tracking-tight leading-none mb-1.5">
                      Booting {adminTab === "dashboard" ? "Dashboard" : adminTab === "studio" ? "Interactive Studio" : adminTab === "slides" ? "Slides Deck Manager" : adminTab === "curriculum" ? "Curriculum Studio" : "Workshop Settings"}...
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono animate-pulse">
                      Loading Koda Workspace
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Dashboard Header */}
            {adminTab !== "studio" && adminTab !== "curriculum" && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-6 shrink-0">
                <div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                    {adminTab === "dashboard" && "📈 Classroom Analytics & Live Progress"}
                    {adminTab === "assets" && "🎨 Custom SVG Maker Library"}
                    {adminTab === "slides" && "🗂️ Worksheet Slides Deck Manager"}
                    {adminTab === "settings" && "⚙️ Workshop System Settings"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {adminTab === "dashboard" && "Real-time indicators, student progression monitoring, and focus areas."}
                    {adminTab === "assets" && "Create, preview, scale, and save your custom vector assets to count."}
                    {adminTab === "slides" && "Reorder, duplicate, seed starter bundles, or modify worksheet questions."}
                    {adminTab === "settings" && "Manage global studio parameters, testing synthesizer frequencies, and database cache resets."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono bg-white text-indigo-600 border-indigo-200 font-extrabold px-3 py-1 text-[10px]">
                    Role: Teacher Account
                  </Badge>
                </div>
              </div>
            )}

            {/* TAB CONTENT: dashboard */}
            {adminTab === "dashboard" && (
              <div className="space-y-6 overflow-y-auto flex-1 pr-1">
                {/* Metrics Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                      <Layers size={18} />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 font-mono">Worksheet Slides</span>
                      <h4 className="text-xl font-black text-slate-800 mt-0.5">{questions.length} Cards</h4>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                      <Crown size={18} />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 font-mono">Advanced Lessons</span>
                      <h4 className="text-xl font-black text-slate-800 mt-0.5">
                        {questions.length > 0 ? Math.round(questions.filter(q => q.technique !== CountingTechnique.ONE_TO_ONE).length / questions.length * 100) : 0}% Match
                      </h4>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                      <Users size={18} />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 font-mono">Live Students</span>
                      <h4 className="text-xl font-black text-slate-800 mt-0.5">{students.length} Active</h4>
                    </div>
                  </div>
                </div>

                {/* Simulated Students Table */}
                <div className="bg-white border border-slate-200/85 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono">Live Classroom Session Tracker</h4>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold animate-pulse">
                      ● Active Connection Live
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase font-mono bg-slate-50/20">
                          <th className="p-4">Student Name</th>
                          <th className="p-4">Pace Speed</th>
                          <th className="p-4">Active Question</th>
                          <th className="p-4">Worksheet Progress</th>
                          <th className="p-4">Status Connection</th>
                          <th className="p-4 text-right">Interactions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                        {students.map((student) => {
                          const activeQ = questions.find(q => q.id === student.activeId) || questions[0];
                          return (
                            <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4 font-bold text-slate-800">{student.name}</td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                                  student.speed === "Super Fast" || student.speed === "Fast"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                    : student.speed === "Needs Help"
                                    ? "bg-rose-50 text-rose-700 border border-rose-100 animate-bounce"
                                    : "bg-amber-50 text-amber-700 border border-amber-100"
                                }`}>
                                  {student.speed}
                                </span>
                              </td>
                              <td className="p-4 text-slate-500 font-mono text-[10px] max-w-[150px] truncate" title={activeQ?.title}>
                                {activeQ?.title || student.activeId}
                              </td>
                              <td className="p-4 text-slate-600 font-mono text-[11px] font-bold">{student.progress}</td>
                              <td className="p-4">
                                <span className="flex items-center gap-1.5">
                                  <span className={`w-2.5 h-2.5 rounded-full ${
                                    student.status === "Done"
                                      ? "bg-emerald-500"
                                      : student.status === "Stuck"
                                      ? "bg-rose-500"
                                      : "bg-sky-500 animate-pulse"
                                  }`} />
                                  <span className="font-bold text-[11px] text-slate-600">{student.status}</span>
                                </span>
                              </td>
                              <td className="p-4 text-right space-x-1.5">
                                <Button
                                  onClick={() => {
                                    sounds.playWin();
                                    alert(`🔔 Pushed encouragement ring chime to ${student.name}!`);
                                    setStudents(prev => prev.map(s => s.id === student.id ? { ...s, speed: "Fast", status: "Active" } : s));
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-[10px] font-extrabold border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100/70 cursor-pointer"
                                >
                                  🔔 Nudge Sound
                                </Button>
                                <Button
                                  onClick={() => {
                                    sounds.playPop();
                                    const nextIdx = (questions.findIndex(q => q.id === student.activeId) + 1) % questions.length;
                                    setStudents(prev => prev.map(s => s.id === student.id ? {
                                      ...s,
                                      activeId: questions[nextIdx].id,
                                      progress: `${nextIdx + 1}/${questions.length} solved`
                                    } : s));
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-[10px] font-bold cursor-pointer"
                                >
                                  Skip Card ➜
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Focus Areas bars */}
                <div className="bg-white border border-slate-200/85 rounded-2xl p-5 shadow-sm space-y-4">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono">Curriculum Focus Breakdown</h4>
                  <div className="space-y-3.5">
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1">
                        <span>1. Kindergarten Core Counting & Cardinality (1-to-1, arrangements)</span>
                        <span>45% focus</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: "45%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1">
                        <span>2. Early Math Arithmetic Operation Sandboxes (Addition, Subtraction, Groups)</span>
                        <span>35% focus</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: "35%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1">
                        <span>3. Playful Classroom Cognitive & Deductive Games (Sudoku, Logic Patterns, Sorting)</span>
                        <span>20% focus</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: "20%" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: slides */}
            {adminTab === "slides" && (
              <div className="space-y-6 overflow-y-auto flex-1 pr-1">
                {/* Quick seed bundles */}
                <div className="bg-white border border-indigo-100 bg-indigo-50/20 p-4 rounded-2xl shadow-sm">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono mb-2">Preset Lessons Seeding Packs</h4>
                  <p className="text-xs text-slate-500 font-medium mb-3.5">Overwrite your current slide deck workspace with curated curriculum bundles instantly:</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        if (window.confirm("Seeding this starter pack will overwrite your active question list. Proceed?")) {
                          const seed = DEFAULT_QUESTIONS.slice(0, 5);
                          saveQuestions(seed);
                          setActiveId(seed[0].id);
                          sounds.playWin();
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs cursor-pointer"
                    >
                      🔢 Early Counting Starter (5 Cards)
                    </Button>
                    <Button
                      onClick={() => {
                        if (window.confirm("Seeding this bundle will overwrite your active question list. Proceed?")) {
                          const seed = DEFAULT_QUESTIONS.slice(9, 12);
                          saveQuestions(seed);
                          setActiveId(seed[0].id);
                          sounds.playWin();
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100 font-bold text-xs cursor-pointer"
                    >
                      🍎 Arithmetic Sandbox Essentials (3 Cards)
                    </Button>
                    <Button
                      onClick={() => {
                        if (window.confirm("Seeding this bundle will overwrite your active question list. Proceed?")) {
                          const seed = DEFAULT_QUESTIONS.slice(12);
                          saveQuestions(seed);
                          setActiveId(seed[0].id);
                          sounds.playWin();
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs cursor-pointer"
                    >
                      🧩 Koda's Playful Logic Games (3 Cards)
                    </Button>
                  </div>
                </div>

                {/* Slides Manager Table */}
                <div className="bg-white border border-slate-200/85 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono">Worksheet Slides Deck Reordering & Operations</h4>
                    <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-mono text-slate-600">
                      Total: {questions.length} cards
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3 hover:bg-slate-50/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-black text-slate-400 font-mono w-5">
                            {idx + 1}.
                          </span>
                          <div>
                            <h5 className="font-bold text-slate-800 leading-tight flex items-center gap-2">
                              {q.title}
                              <Badge variant="outline" className="font-mono text-[8px] font-bold uppercase tracking-wider text-slate-400">
                                {q.technique.replace(/_/g, ' ')}
                              </Badge>
                            </h5>
                            <p className="text-[11px] text-slate-500 font-medium truncate max-w-sm mt-0.5" title={q.instruction}>
                              {q.instruction}
                            </p>
                          </div>
                        </div>

                        {/* Slide action buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 self-stretch sm:self-auto justify-end">
                          <Button
                            onClick={() => {
                              if (idx === 0) return;
                              sounds.playSlide();
                              const updated = [...questions];
                              const temp = updated[idx];
                              updated[idx] = updated[idx - 1];
                              updated[idx - 1] = temp;
                              saveQuestions(updated);
                            }}
                            disabled={idx === 0}
                            variant="outline"
                            className="h-8 w-8 p-0 cursor-pointer"
                            title="Move Card Up"
                          >
                            <ArrowUp size={11} />
                          </Button>
                          <Button
                            onClick={() => {
                              if (idx === questions.length - 1) return;
                              sounds.playSlide();
                              const updated = [...questions];
                              const temp = updated[idx];
                              updated[idx] = updated[idx + 1];
                              updated[idx + 1] = temp;
                              saveQuestions(updated);
                            }}
                            disabled={idx === questions.length - 1}
                            variant="outline"
                            className="h-8 w-8 p-0 cursor-pointer"
                            title="Move Card Down"
                          >
                            <ArrowDown size={11} />
                          </Button>
                          <Button
                            onClick={() => {
                              sounds.playPop();
                              const newId = `q-dup-${Date.now()}`;
                              const newQ: CountingQuestion = {
                                ...q,
                                id: newId,
                                title: `${q.title} (Copy)`,
                                config: { ...q.config }
                              };
                              const updated = [...questions];
                              updated.splice(idx + 1, 0, newQ);
                              saveQuestions(updated);
                              setActiveId(newId);
                            }}
                            variant="outline"
                            className="h-8 px-2.5 text-[10px] font-extrabold cursor-pointer"
                            title="Duplicate Card"
                          >
                            👥 Duplicate
                          </Button>
                          <Button
                            onClick={() => {
                              if (questions.length <= 1) return;
                              sounds.playFailure();
                              const updated = questions.filter(item => item.id !== q.id);
                              saveQuestions(updated);
                              if (activeId === q.id) {
                                setActiveId(updated[0].id);
                              }
                            }}
                            disabled={questions.length <= 1}
                            variant="destructive"
                            className="h-8 px-2.5 text-[10px] font-bold cursor-pointer"
                            title="Delete Card"
                          >
                            Delete
                          </Button>
                          <Button
                            onClick={() => {
                              sounds.playPop();
                              setActiveId(q.id);
                              setAdminTab("studio");
                            }}
                            className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] cursor-pointer"
                            title="Edit Card in Canvas Studio"
                          >
                            ✏️ Edit Slide
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bulk Import / Export JSON block */}
                <div className="bg-white border border-slate-200/85 rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono">Worksheet Bulk Import & Export Studio</h4>
                  <p className="text-xs text-slate-500 font-medium">Export all question slides as a single JSON file, or paste a worksheet deck schema to overwrite the workspace.</p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        const jsonStr = JSON.stringify(questions, null, 2);
                        navigator.clipboard.writeText(jsonStr).then(() => {
                          sounds.playSuccess();
                          alert("Worksheet Deck JSON schema copied to clipboard!");
                        });
                      }}
                      variant="outline"
                      className="border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs cursor-pointer"
                    >
                      Copy Complete Deck JSON
                    </Button>
                    <Button
                      onClick={() => {
                        const val = prompt("Paste full worksheet deck JSON string here:");
                        if (val) {
                          try {
                            const parsed = JSON.parse(val) as CountingQuestion[];
                            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
                              saveQuestions(parsed);
                              setActiveId(parsed[0].id);
                              sounds.playSuccess();
                              alert("Successfully restored worksheet deck from JSON schema!");
                            } else {
                              alert("Invalid worksheet deck array format.");
                            }
                          } catch (e) {
                            alert("Failed to parse JSON. Please check syntax formatting.");
                          }
                        }
                      }}
                      variant="outline"
                      className="font-bold text-xs cursor-pointer"
                    >
                      Import Deck JSON
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: settings */}
            {adminTab === "settings" && (
              <div className="space-y-6 overflow-y-auto flex-1 pr-1 bg-white border border-slate-200/85 p-6 rounded-2xl shadow-sm">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono border-b border-slate-100 pb-1.5 mb-2">Offline Synthesizer Engine Test</h4>
                    <p className="text-xs text-slate-500 font-medium mb-3">Audibly verify Web Audio API oscillator envelopes. Tap below to trigger specific early childhood chimes:</p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => sounds.playPop()} variant="outline" className="text-xs font-bold cursor-pointer">
                        Play Pop (Selection)
                      </Button>
                      <Button onClick={() => sounds.playTick(3)} variant="outline" className="text-xs font-bold cursor-pointer">
                        Play Chime (Tick)
                      </Button>
                      <Button onClick={() => sounds.playTock()} variant="outline" className="text-xs font-bold cursor-pointer">
                        Play Lower Chime (Tock)
                      </Button>
                      <Button onClick={() => sounds.playWin()} variant="outline" className="text-xs font-bold cursor-pointer">
                        Play Arpeggio (Win)
                      </Button>
                      <Button onClick={() => sounds.playFail()} variant="outline" className="text-xs font-bold cursor-pointer">
                        Play Flat Chord (Fail)
                      </Button>
                      <Button onClick={() => sounds.playLevelUp()} variant="outline" className="text-xs font-bold cursor-pointer">
                        Play Level Up
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono border-b border-slate-100 pb-1.5 mb-2 mt-6">Safety Override Operations</h4>
                    <p className="text-xs text-slate-500 font-medium mb-3">Clear client-side states, force rebuild local storage cache, and reload factory presets.</p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          if (window.confirm("Danger: Clear all local storage caching and restore original worksheet deck? This cannot be undone.")) {
                            localStorage.removeItem("counting_studio_questions");
                            setQuestions(DEFAULT_QUESTIONS);
                            setActiveId(DEFAULT_QUESTIONS[0].id);
                            sounds.playLevelUp();
                            alert("Workspace caches cleared. Original templates restored!");
                          }
                        }}
                        variant="destructive"
                        className="text-xs font-bold cursor-pointer"
                      >
                        Factory Reset Database Cache
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: assets (Custom SVG Maker) */}
            {adminTab === "assets" && (
              <SvgDesigner 
                customSvgs={customSvgs} 
                setCustomSvgs={setCustomSvgs} 
                questions={questions}
                setQuestions={setQuestions}
                svgOverrides={svgOverrides}
                setSvgOverrides={setSvgOverrides}
              />
            )}
            {adminTab === "studio" && (
              <main className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-slate-50 animate-fade-in">
        
        {/* LEFT PANEL: Lesson Worksheet slides list */}
        <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lesson Worksheet</h2>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-150 px-2 py-0.5 rounded-full font-mono">
              {questions.length} Cards
            </span>
          </div>

          {/* Scrollable list items container */}
          <div className="flex-1 p-4 overflow-y-auto space-y-2 min-h-[220px]">
            {questions.map((q, idx) => {
              const isActive = q.id === activeId;
              const activeObj = COUNT_OBJECTS.find(o => o.id === q.objectId) || COUNT_OBJECTS[0];
              return (
                <div
                  key={q.id}
                  onClick={() => {
                    setActiveId(q.id);
                    setIsSuccess(false);
                    sounds.playPop();
                  }}
                  className={`group flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all
                    ${isActive 
                      ? "bg-indigo-50 border-indigo-300 shadow-sm animate-fade-in" 
                      : "bg-slate-50 border-slate-200 hover:border-indigo-200 hover:shadow-sm hover:bg-white"
                    }
                  `}
                >
                  {/* Square icon/number badge like reference */}
                  <div className={`w-8 h-8 shrink-0 flex items-center justify-center rounded border font-mono text-xs font-bold transition-all
                    ${isActive 
                      ? "bg-indigo-600 text-white border-indigo-500" 
                      : "bg-white text-slate-500 border-slate-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200"
                    }
                  `}>
                    {idx + 1}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <h4 className={`text-xs font-bold truncate leading-tight transition-colors
                      ${isActive ? "text-indigo-950 font-extrabold" : "text-slate-700 group-hover:text-slate-900"}
                    `}>
                      {q.title.replace(/^\d+\.\s*/, "")}
                    </h4>
                    <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs select-none select-none-all leading-none">
                        {activeObj.id === "custom_svg" ? (
                          <CountingAsset type="custom_svg" emoji={activeObj.emoji} size={14} className="inline-block align-middle" />
                        ) : (
                          activeObj.emoji
                        )}
                      </span>
                      <span>Count: {q.targetCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom actions container with tips */}
          <div className="mt-auto p-4 bg-indigo-50 border-t border-indigo-100 flex flex-col gap-3">
            <Button
              onClick={() => {
                setAdminTab("dashboard");
                sounds.playPop();
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold flex items-center justify-center gap-1.5 shadow-sm border border-amber-600/20 cursor-pointer"
            >
              <BarChart2 size={14} />
              Classroom Dashboard
            </Button>
            <Button
              onClick={addNewQuestion}
              variant="outline"
              size="sm"
              className="w-full bg-white hover:bg-indigo-50 border-indigo-150 text-indigo-600 font-bold"
            >
              <Plus size={14} />
              Add New Card
            </Button>
            <p className="text-[10px] leading-relaxed text-indigo-700/80 font-medium">
              <strong>Tip:</strong> Reorder, duplicate, or delete cards to customize the worksheet flow for student lesson delivery.
            </p>
            <div className="text-[9px] text-slate-400 font-mono border-t border-indigo-100/40 pt-2 text-center">
              Counting Objects Skills © 2026
            </div>
          </div>
        </aside>

        {/* CENTER COLUMN: PREVIEW CANVAS ARENA */}
        <section className="flex-1 bg-slate-50 p-6 md:p-8 overflow-y-auto relative flex flex-col items-center justify-start gap-6">
          
          <div className="max-w-2xl w-full flex flex-col gap-6">
            
            {/* Active Workspace Card - styled EXACTLY like the active card in the Reference design */}
            <div className="bg-white rounded-xl shadow-md border-2 border-indigo-500 p-6 relative">
              
              {/* Card Header Information */}
              <div className="mb-4">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider font-mono">
                    Technique Card #{currentIdx + 1}: {activeQuestion?.technique.replace(/_/g, ' ')}
                  </span>
                </div>
                
                <h3 className="text-lg md:text-xl font-bold tracking-tight text-slate-800 leading-snug">
                  {activeQuestion?.title || "How many are there?"}
                </h3>
                {(() => {
                  let instructionText = activeQuestion?.instruction;
                  if (activeQuestion?.technique === CountingTechnique.FLEXIBLE_CANVAS) {
                    // Generate dynamic instruction if it's the default template but items/targets have changed!
                    const config = activeQuestion.config;
                    const items = config.flexibleItems || [];
                    const targets = config.flexibleTargets || [];
                    const mode = config.flexibleMode || "multichoice";
                    
                    const isDefaultApplesBalloons = activeQuestion.instruction?.includes("Apples") && activeQuestion.instruction?.includes("Balloons");
                    const hasDefaultItems = items.length === 5 && items.filter((i: any) => i.emoji === "🍎").length === 3 && items.filter((i: any) => i.emoji === "🎈").length === 2;

                    if (!activeQuestion.instruction || (isDefaultApplesBalloons && !hasDefaultItems)) {
                      if (mode === "dragmatch") {
                        const labels = targets.map((t: any) => t.label).filter(Boolean);
                        instructionText = labels.length > 0 
                          ? `Sort the items! Drag each item to its correct container: ${labels.join(" or ")}!`
                          : "Sort the items! Drag each item into its matching bin container.";
                      } else if (mode === "tapcount") {
                        instructionText = `Tap on every item to count them up to ${items.length}!`;
                      } else {
                        instructionText = "How many items are on the screen? Count them and select your answer!";
                      }
                    }
                  } else if (activeQuestion?.technique === CountingTechnique.COUNT_BACK) {
                    const total = activeQuestion.config.totalCount || 8;
                    const remove = activeQuestion.config.removeCount || 3;
                    const seq = [];
                    for (let i = 0; i <= remove; i++) {
                      seq.push(total - i);
                    }
                    instructionText = `Start at ${total} and tap/cross out items to count backward: ${seq.join("... ")}!`;
                  } else if (activeQuestion?.technique === CountingTechnique.COUNT_ON) {
                    const base = activeQuestion.config.baseCount || 5;
                    const extra = activeQuestion.config.extraCount || 3;
                    const seq = [];
                    for (let i = 1; i <= extra; i++) {
                      seq.push(base + i);
                    }
                    instructionText = `Start from ${base} in the hand. Drag the extra items and count on: ${base}... ${seq.join(", ")}!`;
                  }

                  if (!instructionText) return null;
                  return (
                    <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-200 mt-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 rounded-xl px-4 py-2.5">
                      {instructionText}
                    </p>
                  );
                })()}
              </div>

              {/* Workspace Scale Zoom Controller */}
              <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <ZoomIn size={13} className="text-indigo-500" />
                  <span>Canvas Zoom</span>
                </div>
                <div className="flex items-center gap-2.5 flex-1 w-full sm:max-w-[240px]">
                  <span className="text-[10px] text-slate-400 font-bold font-mono">50%</span>
                  <input
                    id="canvas-zoom-slider"
                    type="range"
                    min="50"
                    max="150"
                    step="5"
                    value={zoom}
                    onChange={(e) => {
                      setZoom(parseInt(e.target.value));
                    }}
                    className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    title="Drag to zoom counting workspace scale"
                  />
                  <span className="text-[10px] text-slate-400 font-bold font-mono">150%</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 justify-between w-full sm:w-auto">
                  <span className="font-mono text-xs text-indigo-600 font-extrabold bg-indigo-50 border border-indigo-100/80 px-2.5 py-0.5 rounded-md min-w-[44px] text-center">
                    {zoom}%
                  </span>
                  <div className="flex gap-1.5">
                    {zoom !== 100 && (
                      <Button
                        id="reset-zoom-button"
                        onClick={() => {
                          setZoom(100);
                          sounds.playPop();
                        }}
                        variant="ghost"
                        size="xs"
                        className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded"
                      >
                        Reset Zoom
                      </Button>
                    )}
                    {activeQuestion?.config?.workspaceHeight && activeQuestion.config.workspaceHeight !== 540 && (
                      <Button
                        id="reset-height-button"
                        onClick={() => {
                          sounds.playPop();
                          updateActiveQuestion({
                            config: {
                              ...activeQuestion.config,
                              workspaceHeight: 540
                            }
                          });
                        }}
                        variant="ghost"
                        size="xs"
                        className="text-[10px] font-extrabold text-slate-500 hover:text-indigo-650 hover:bg-slate-100 px-2 py-1 rounded"
                      >
                        Reset Height
                      </Button>
                    )}
                    {activeQuestion?.config?.workspaceWidth && (
                      <Button
                        id="reset-width-button"
                        onClick={() => {
                          sounds.playPop();
                          updateActiveQuestion({
                            config: {
                              ...activeQuestion.config,
                              workspaceWidth: undefined
                            }
                          });
                        }}
                        variant="ghost"
                        size="xs"
                        className="text-[10px] font-extrabold text-slate-500 hover:text-indigo-650 hover:bg-slate-100 px-2 py-1 rounded"
                      >
                        Reset Width
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Core Active Canvas Component */}
              <div className="w-full overflow-x-auto pb-2">
                <div 
                  id="interactive-workspace-wrapper"
                  ref={workspaceWrapperRef}
                  style={{
                    height: `${workspaceHeight}px`,
                    width: workspaceWidth ? `${workspaceWidth}px` : "100%"
                  }}
                  className="relative mx-auto flex items-stretch justify-stretch border border-slate-100 rounded-2xl bg-white transition-all overflow-hidden min-w-[360px]"
                >
                  <div className="w-full h-full flex items-stretch justify-stretch overflow-auto">
                  <motion.div 
                    className="w-full h-full flex items-stretch justify-stretch"
                    animate={{ scale: zoom / 100 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    style={{
                      transformOrigin: 'center center'
                    }}
                  >
                    {renderCanvas()}
                  </motion.div>
                  </div>

                  {/* Grid Overlay */}
                  {!isPlayMode && showGrid && (
                    <div 
                      className="absolute inset-0 pointer-events-none z-30"
                      style={{
                        backgroundImage: "radial-gradient(#6b46c1 1.2px, transparent 1.2px)",
                        backgroundSize: `${activeQuestion.config.layoutGridSize || 20}px ${activeQuestion.config.layoutGridSize || 20}px`,
                        opacity: 0.12
                      }}
                    />
                  )}

                  {/* Resize Handles (Design Mode only) */}
                  {!isPlayMode && (
                    <>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, "height")}
                        onTouchStart={(e) => handleResizeStart(e, "height")}
                        className="absolute bottom-0 left-0 right-4 h-4 bg-slate-100 hover:bg-indigo-50 border-t border-slate-200 cursor-ns-resize z-40 select-none flex items-center justify-center group transition-colors"
                        title="Drag to resize workspace height"
                      >
                        <div className="flex gap-1.5 items-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-500 transition-colors" />
                          <div className="w-10 h-1.5 rounded-full bg-slate-350 group-hover:bg-indigo-500 transition-colors" />
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-500 transition-colors" />
                        </div>

                        {localHeight !== null && localWidth === null && (
                          <div className="absolute -top-9 bg-slate-850 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded shadow-lg z-50 animate-scale-in">
                            Height: {localHeight}px
                          </div>
                        )}
                      </div>

                      <div
                        onMouseDown={(e) => handleResizeStart(e, "width")}
                        onTouchStart={(e) => handleResizeStart(e, "width")}
                        className="absolute right-0 top-0 bottom-4 w-4 bg-slate-100 hover:bg-indigo-50 border-l border-slate-200 cursor-ew-resize z-40 select-none flex items-center justify-center group transition-colors"
                        title="Drag to resize workspace width"
                      >
                        <div className="flex flex-col gap-1.5 items-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-500 transition-colors" />
                          <div className="w-1.5 h-10 rounded-full bg-slate-350 group-hover:bg-indigo-500 transition-colors" />
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-500 transition-colors" />
                        </div>

                        {localWidth !== null && localHeight === null && (
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 bg-slate-850 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded shadow-lg z-50 animate-scale-in whitespace-nowrap">
                            Width: {localWidth}px
                          </div>
                        )}
                      </div>

                      <div
                        onMouseDown={(e) => handleResizeStart(e, "both")}
                        onTouchStart={(e) => handleResizeStart(e, "both")}
                        className="absolute right-0 bottom-0 w-4 h-4 bg-indigo-100 hover:bg-indigo-200 border-l border-t border-indigo-200 cursor-nwse-resize z-50 select-none flex items-center justify-center transition-colors"
                        title="Drag to resize workspace width and height"
                      >
                        <div className="w-2 h-2 border-r-2 border-b-2 border-indigo-500" />
                        {localWidth !== null && localHeight !== null && (
                          <div className="absolute right-6 bottom-6 bg-slate-850 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded shadow-lg z-50 animate-scale-in whitespace-nowrap">
                            {localWidth}px × {localHeight}px
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Dynamic Child Instruction box below canvas */}
              <div className="mt-4 p-3.5 bg-indigo-50/50 border border-indigo-100/50 rounded-xl flex items-start gap-2.5">
                <HelpCircle className="text-indigo-500 shrink-0 mt-0.5" size={15} />
                <div>
                  <span className="text-[9px] font-bold text-indigo-500 font-mono uppercase tracking-widest block mb-0.5">Student Instructions</span>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {activeQuestion?.instruction}
                  </p>
                </div>
              </div>

              {/* Success Banner inside Studio card */}
              {isSuccess && (
                <div className="mt-4 bg-emerald-500 text-white p-3.5 rounded-xl flex items-center justify-between gap-3 animate-scale-in border border-emerald-400 shadow-lg">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-amber-200 animate-pulse" />
                    <span className="text-xs font-bold">Solved successfully! Excellent counting job.</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={resetSlide}
                      className="text-[10px] font-bold bg-white/25 hover:bg-white/35 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                    {currentIdx < questions.length - 1 && (
                      <button
                        onClick={() => {
                          setIsSuccess(false);
                          setActiveId(questions[currentIdx + 1].id);
                          sounds.playPop();
                        }}
                        className="text-[10px] font-bold bg-white text-emerald-600 px-3 py-1 rounded-lg transition-colors shadow-sm cursor-pointer"
                      >
                        Next Card
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Worksheet deck position controller (slide up / down) */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="text-xs bg-slate-100 text-slate-600 font-mono font-bold px-2.5 py-1 rounded-full border border-slate-200">
                  Card {currentIdx + 1} of {questions.length}
                </span>
                <span className="hidden sm:inline text-xs text-slate-500 font-medium">Reorder card positions:</span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => moveQuestion("up")}
                  disabled={currentIdx === 0}
                  variant="outline"
                  size="sm"
                  title="Move Slide Up"
                >
                  <ChevronUp size={14} />
                  Up
                </Button>
                <Button
                  onClick={() => moveQuestion("down")}
                  disabled={currentIdx === questions.length - 1}
                  variant="outline"
                  size="sm"
                  title="Move Slide Down"
                >
                  <ChevronDown size={14} />
                  Down
                </Button>
              </div>
            </div>

          </div>
        </section>

        {/* RIGHT PANEL: ADVANCED PROPERTY STUDIO & JSON SCHEMA HANDLER */}
        {isPropStudioCollapsed ? (
          <aside className="w-full md:w-12 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 flex flex-col items-center py-4 shrink-0 overflow-hidden">
            <button
              onClick={() => {
                setIsPropStudioCollapsed(false);
                sounds.playPop();
              }}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all cursor-pointer mb-6"
              title="Expand Property Studio"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1 flex items-center justify-center [writing-mode:vertical-lr] select-none pointer-events-none">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                Property Studio
              </span>
            </div>
          </aside>
        ) : (
          <aside className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col shrink-0 overflow-hidden">
            {/* Section Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsPropStudioCollapsed(true);
                      sounds.playPop();
                    }}
                    className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all cursor-pointer shadow-sm"
                    title="Collapse Property Studio"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <h2 className="text-sm font-extrabold text-slate-800 tracking-tight">Property Studio</h2>
                  {isSaving && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 animate-fade-in text-[10px] px-1.5 py-0">
                      Saved
                    </Badge>
                  )}
                </div>
              </div>

              {/* Custom Tab Switcher */}
              <Tabs value={activePropTab} onValueChange={(val) => {
                setActivePropTab(val as any);
                sounds.playPop();
              }}>
                <TabsList className="grid grid-cols-5 gap-1 w-full">
                  <TabsTrigger value="visual" className="flex items-center justify-center gap-1 text-[11px] font-bold">
                    <Eye size={12} className="text-indigo-500" />
                    <span>Visual</span>
                  </TabsTrigger>
                  <TabsTrigger value="design" className="flex items-center justify-center gap-1 text-[11px] font-bold">
                    <Edit3 size={12} className="text-emerald-500" />
                    <span>Design</span>
                  </TabsTrigger>
                  <TabsTrigger value="component" className="flex items-center justify-center gap-1 text-[11px] font-bold">
                    <Sliders size={12} className="text-purple-500" />
                    <span>Rules</span>
                  </TabsTrigger>
                  <TabsTrigger value="json" className="flex items-center justify-center gap-1 text-[11px] font-bold">
                    <Layers size={12} className="text-amber-500" />
                    <span>JSON</span>
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="flex items-center justify-center gap-1 text-[11px] font-bold">
                    <Wand2 size={12} className="text-fuchsia-500" />
                    <span>AI ✨</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

          <div className="flex-1 p-5 overflow-y-auto min-h-[350px]">
            {activePropTab === "visual" && (
              <div className="space-y-5 animate-fade-in">
                {/* Card title input */}
                <div className="flex flex-col gap-1.5">
                  <Label>Question Title</Label>
                  <Input
                    type="text"
                    value={activeQuestion?.title || ""}
                    onChange={(e) => updateActiveQuestion({ title: e.target.value })}
                    placeholder="E.g. Counting Apples"
                  />
                </div>

                {/* Child instructions textarea */}
                <div className="flex flex-col gap-1.5">
                  <Label>Instructions Hint</Label>
                  <Textarea
                    rows={2}
                    value={activeQuestion?.instruction || ""}
                    onChange={(e) => updateActiveQuestion({ instruction: e.target.value })}
                    placeholder="Touch each object to count them up!"
                  />
                </div>

                 {/* Techniques selection dropdown */}
                <div className="flex flex-col gap-1.5">
                  <Label>Counting Technique</Label>
                  <div className="grid grid-cols-1 gap-1 max-h-[140px] overflow-y-auto pr-1">
                    {TECHNIQUE_OPTIONS.map((tech) => {
                      const isSelected = activeQuestion?.technique === tech.id;
                      return (
                        <button
                          key={tech.id}
                          onClick={() => {
                            sounds.playPop();
                            updateActiveQuestion({
                              technique: tech.id,
                              title: tech.name,
                              targetCount: defaultTargetCountForTechnique(tech.id)
                            });
                          }}
                          className={`text-[11px] font-bold p-2 rounded-lg border text-left transition-all truncate cursor-pointer flex items-center gap-2
                            ${isSelected 
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                            }
                          `}
                        >
                          <span className="flex-shrink-0">{React.cloneElement(tech.icon, { className: isSelected ? "text-white" : tech.icon.props.className })}</span>
                          <span className="truncate">{tech.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SVG Assets picker */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <Label>SVG Assets</Label>
                    <span className="text-[9px] bg-violet-50 text-violet-600 font-mono font-bold px-1.5 py-0.5 rounded border border-violet-100 uppercase tracking-wider">Vector</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SVG_OBJECTS.map((item) => {
                      const isSelected = activeQuestion?.objectId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            sounds.playPop();
                            const updates: Partial<CountingQuestion> = { objectId: item.id };
                            if (item.assetType) {
                              updates.config = {
                                ...activeQuestion.config,
                                assetType: item.assetType
                              };
                            }
                            updateActiveQuestion(updates);
                          }}
                          className={`h-11 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                            isSelected 
                              ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/25 scale-105" 
                              : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                          }`}
                          title={item.label}
                        >
                          <CountingAsset type={item.assetType as any} size={28} />
                        </button>
                      );
                    })}
                  </div>

                  {/* My Custom Library SVGs listing */}
                  <div className="flex flex-col gap-1.5 mt-3 border-t border-slate-100 pt-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] text-slate-400 uppercase font-black">My Custom Library</Label>
                      <span className="text-[9px] bg-indigo-50 text-indigo-600 font-mono font-bold px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-wider">Library</span>
                    </div>

                    {customSvgs.length > 0 ? (
                      <div className="grid grid-cols-4 gap-1.5">
                        {customSvgs.map((asset) => {
                          const isSelected = activeQuestion?.objectId === "custom_svg" && activeQuestion.config?.customSvgMarkup === asset.markup;
                          return (
                            <button
                              key={asset.id}
                              onClick={() => {
                                sounds.playPop();
                                updateActiveQuestion({
                                  objectId: "custom_svg",
                                  config: {
                                    ...activeQuestion.config,
                                    assetType: "custom_svg",
                                    customSvgMarkup: asset.markup,
                                    customSvgLabel: asset.label,
                                    customSvgScale: asset.scale
                                  }
                                });
                              }}
                              className={`h-11 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                                isSelected 
                                  ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/25 scale-105" 
                                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                              }`}
                              title={asset.label}
                            >
                              <CountingAsset type="custom_svg" customSvgMarkup={asset.markup} size={28} />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center p-3 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <p className="text-[10px] text-slate-500 font-bold">No custom SVGs built yet</p>
                        <button
                          onClick={() => {
                            setAdminTab("assets");
                            sounds.playPop();
                          }}
                          className="mt-1 text-[9px] text-indigo-600 hover:text-indigo-800 font-black underline cursor-pointer"
                        >
                          Create Custom SVG &rarr;
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Emoji Assets picker */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <Label>Emoji Assets</Label>
                    <span className="text-[9px] bg-amber-50 text-amber-600 font-mono font-bold px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-wider">Emoji</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {EMOJI_OBJECTS.map((item) => {
                      const isSelected = activeQuestion?.objectId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            sounds.playPop();
                            const updates: Partial<CountingQuestion> = { objectId: item.id };
                            if (item.assetType) {
                              updates.config = {
                                ...activeQuestion.config,
                                assetType: item.assetType
                              };
                            }
                            updateActiveQuestion(updates);
                          }}
                          className={`text-2xl h-11 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                            isSelected 
                              ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/25 scale-105" 
                              : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                          }`}
                          title={item.label}
                        >
                          {item.emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target goal slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <Label>Target Count</Label>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 font-mono font-bold px-2 py-0.5 rounded border border-indigo-100">
                      {activeQuestion?.targetCount || 5} items
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={activeQuestion?.technique === CountingTechnique.GROUP_IN_TENS ? 20 : 10}
                    value={activeQuestion?.targetCount || 5}
                    onChange={(e) => updateActiveQuestion({ targetCount: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>
            )}
            
            {activePropTab === "design" && (
              <div className="space-y-4 animate-fade-in">
                <Label>Canvas Layout</Label>
                <p className="text-xs text-slate-500">Switch to Design Mode on Tablet/Desktop to drag items to custom coordinates.</p>
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-700 font-medium">
                  💡 On Mobile viewports (`&lt;768px`), canvases automatically operate in Student Play Mode to provide a smart, touch-optimized display layout.
                </div>
                <Button 
                  onClick={() => setIsPlayMode(!isPlayMode)}
                  variant={isPlayMode ? "outline" : "default"}
                  className="w-full"
                >
                  {isPlayMode ? "Switch to Design Mode" : "Switch to Play Mode"}
                </Button>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label>Snap Grid</Label>
                      <p className="text-[11px] text-slate-500 mt-0.5">Show guides and snap dragged objects on release.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <Label>Grid Size</Label>
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 font-mono font-bold px-2 py-0.5 rounded border border-indigo-100">
                        {activeQuestion.config.layoutGridSize || 20}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={40}
                      step={5}
                      value={activeQuestion.config.layoutGridSize || 20}
                      onChange={(e) => updateActiveQuestion({
                        config: { ...activeQuestion.config, layoutGridSize: parseInt(e.target.value) }
                      })}
                      className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label>Rulers</Label>
                      <p className="text-[11px] text-slate-500 mt-0.5">Show pixel markers for visual alignment.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={activeQuestion.config.showLayoutRulers ?? true}
                      onChange={(e) => updateActiveQuestion({
                        config: { ...activeQuestion.config, showLayoutRulers: e.target.checked }
                      })}
                      className="w-4 h-4 text-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>

                {activeQuestion?.config?.customPositions && (
                  <Button
                    onClick={() => updateActiveQuestion({
                      config: {
                        ...activeQuestion.config,
                        customPositions: undefined,
                        layoutReference: undefined
                      }
                    })}
                    variant="outline"
                    className="w-full"
                  >
                    Reset Custom Object Layout
                  </Button>
                )}
                {activeQuestion?.config?.customPositions && (
                  <pre className="text-[10px] bg-slate-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify({
                      layoutReference: activeQuestion.config.layoutReference,
                      customPositions: activeQuestion.config.customPositions
                    }, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {activePropTab === "component" && (
              <div className="space-y-5 animate-fade-in">
                <div className="border border-slate-100 bg-slate-50 p-3 rounded-xl mb-2">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 font-mono">Component Category</span>
                  <p className="text-xs font-bold text-slate-800 truncate mt-0.5">
                    {activeQuestion?.technique.replace(/_/g, ' ')}
                  </p>
                </div>

                {/* ONE_TO_ONE specific settings */}
                {activeQuestion && (() => {
                  const TechniquePanel = TECHNIQUE_PANELS[activeQuestion.technique];
                  return TechniquePanel ? (
                    <LazyBoundary>
                      <TechniquePanel
                        question={activeQuestion}
                        update={updateActiveQuestion}
                        updateConfig={(patch) => updateActiveQuestion({ config: { ...activeQuestion.config, ...patch } })}
                      />
                    </LazyBoundary>
                  ) : null;
                })()}

                {/* MOVE_AND_COUNT specific settings */}

                {/* LINE_UP_AND_COUNT specific settings */}

                {/* GROUP_IN_TENS specific settings */}

                {/* COUNT_ON specific settings */}

                {/* COUNT_BACK specific settings */}

                {/* DIFFERENT_ARRANGEMENTS specific settings */}

                {/* COUNT_MAGNETS specific settings */}

                {/* SUBITIZE specific settings */}

                {/* ADDITION specific settings */}

                {/* SUBTRACTION specific settings */}

                {/* MULTIPLICATION specific settings */}

                {/* SUDOKU specific settings */}

                {/* PATTERN specific settings */}

                {/* FLEXIBLE_CANVAS specific settings */}

                {/* Global Reset Custom Layouts button in Rules panel */}
                {(activeQuestion?.config?.customPositions || 
                  activeQuestion?.config?.containerPositions || 
                  (activeQuestion?.config as any)?.basketDimensions || 
                  (activeQuestion?.config as any)?.shelfDimensions || 
                  (activeQuestion?.config as any)?.plateDimensions) && (
                  <div className="pt-4 border-t border-slate-150">
                    <Button
                      onClick={() => {
                        sounds.playPop();
                        updateActiveQuestion({
                          config: {
                            ...activeQuestion.config,
                            customPositions: undefined,
                            layoutReference: undefined,
                            containerPositions: undefined,
                            basketDimensions: undefined,
                            shelfDimensions: undefined,
                            plateDimensions: undefined
                          } as any
                        });
                      }}
                      variant="destructive"
                      className="w-full text-xs font-bold py-2.5 flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw size={12} />
                      Reset Custom Layouts & Positions
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activePropTab === "json" && (
              <div className="space-y-4 h-full flex flex-col animate-fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Live Slide JSON Schema</label>
                  {jsonError ? (
                    <span className="text-[9px] px-2 py-0.5 bg-rose-100 border border-rose-200 text-rose-600 rounded-full font-bold animate-pulse">
                      Syntax Error
                    </span>
                  ) : (
                    <span className="text-[9px] px-2 py-0.5 bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-full font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block font-mono"></span>
                      Valid schema
                    </span>
                  )}
                </div>

                <div className="flex-1 flex flex-col min-h-[260px] relative">
                  <textarea
                    rows={12}
                    value={jsonInput}
                    onChange={(e) => handleJsonChange(e.target.value)}
                    className={`w-full flex-1 p-3 font-mono text-[10px] border rounded-lg focus:ring-4 outline-none transition-all resize-none leading-relaxed
                      ${jsonError 
                        ? "border-rose-400 focus:ring-rose-100/50 bg-rose-50/10 text-rose-900" 
                        : "border-slate-200 focus:ring-indigo-100/50 bg-slate-900 text-slate-100"
                      }
                    `}
                    placeholder="Enter slide schema JSON here..."
                  />
                </div>

                {jsonError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[10px] leading-relaxed font-semibold">
                    {jsonError}
                  </div>
                )}

                <p className="text-[10px] text-slate-400 leading-normal italic font-medium">
                  <strong>Direct JSON Modification:</strong> You can edit the values above (e.g. modify targetCount, objectId, title, or config parameters) directly. Changes are live-synced in real-time.
                </p>
              </div>
            )}

            {activePropTab === "ai" && activeQuestion && (
              <AiGeneratorPanel
                activeQuestion={activeQuestion}
                questions={questions}
                updateActiveQuestion={updateActiveQuestion}
                onAddSlides={addSlides}
                onSwitchToVisual={() => setActivePropTab("visual")}
              />
            )}
          </div>

          {/* Duplicator utilities footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex flex-col gap-2">
            <Button
              onClick={duplicateActive}
              variant="outline"
              size="sm"
              className="w-full text-slate-600 hover:text-slate-800"
            >
              <Copy size={13} />
              Duplicate Slide Card
            </Button>
            <Button
              onClick={deleteActive}
              disabled={questions.length <= 1}
              variant="destructive"
              size="sm"
              className="w-full"
            >
              Delete Slide Card
            </Button>
          </div>
        </aside>
        )}
      </main>
    )}

            {/* TAB CONTENT: curriculum studio — owns its own header/breadcrumb, no shared header block above */}
            {adminTab === "curriculum" && (
              <CurriculumStudioPage
                questions={questions}
                saveQuestions={saveQuestions}
                customSvgs={customSvgs}
                onOpenSvgMaker={() => setAdminTab("assets")}
              />
            )}
              </>
            )}
          </div>
        </div>

      <UIPaletteLab isOpen={isPaletteLabOpen} onClose={() => setIsPaletteLabOpen(false)} />
      {/* Dynamic Confetti */}
      {confetti.map(p => (
        <div
          key={p.id}
          style={{
            left: p.left,
            animationDelay: p.delay,
            width: p.size,
            height: p.size
          }}
          className={`fixed -top-10 rounded-full opacity-0 animate-confetti z-[9999] pointer-events-none ${p.color}`}
        />
      ))}
    </div>
  );
}
