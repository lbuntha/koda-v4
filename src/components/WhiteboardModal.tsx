import React, { useRef, useState, useEffect } from "react";
import {
  X,
  Eraser,
  Pen,
  Trash2,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  LayoutTemplate,
  Grid,
  Minus,
  Square,
  Layers,
  Check,
} from "lucide-react";
import { playSound } from "../utils/audio";

export type WhiteboardTemplate = "blank" | "grid" | "number_line" | "coordinate_plane";

interface TemplateOption {
  id: WhiteboardTemplate;
  name: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    id: "blank",
    name: "Blank Slate",
    desc: "Clean dark scratchpad",
    icon: Square,
  },
  {
    id: "grid",
    name: "Grid Paper",
    desc: "Fine grid for geometry & alignment",
    icon: Grid,
  },
  {
    id: "number_line",
    name: "Number Line",
    desc: "Labeled -10 to +10 axis with ticks",
    icon: Minus,
  },
  {
    id: "coordinate_plane",
    name: "Coordinate Plane",
    desc: "X-Y Cartesian grid with (0,0)",
    icon: Layers,
  },
];

interface WhiteboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProblemTitle?: string;
  onAnalyzeDrawing: (imageBase64: string) => void;
  isLoading: boolean;
  aiFeedback?: string | null;
}

export const WhiteboardModal: React.FC<WhiteboardModalProps> = ({
  isOpen,
  onClose,
  currentProblemTitle,
  onAnalyzeDrawing,
  isLoading,
  aiFeedback,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#22d3ee"); // Cyan
  const [lineWidth, setLineWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhiteboardTemplate>("blank");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  const renderBackground = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    template: WhiteboardTemplate
  ) => {
    // Fill base background
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, width, height);

    if (template === "grid") {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      const step = 24;
      for (let x = 0; x <= width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    } else if (template === "coordinate_plane") {
      ctx.save();
      const step = 24;
      const centerX = Math.floor(width / (2 * step)) * step;
      const centerY = Math.floor(height / (2 * step)) * step;

      // Sub-grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Main Axes
      ctx.strokeStyle = "rgba(34, 211, 238, 0.6)"; // cyan
      ctx.lineWidth = 2;
      // X Axis
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
      // Y Axis
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, height);
      ctx.stroke();

      // Arrows
      ctx.fillStyle = "rgba(34, 211, 238, 0.8)";
      // X Arrow
      ctx.beginPath();
      ctx.moveTo(width - 6, centerY - 4);
      ctx.lineTo(width, centerY);
      ctx.lineTo(width - 6, centerY + 4);
      ctx.fill();
      // Y Arrow
      ctx.beginPath();
      ctx.moveTo(centerX - 4, 6);
      ctx.lineTo(centerX, 0);
      ctx.lineTo(centerX + 4, 6);
      ctx.fill();

      // Axis numbers
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let x = centerX + step * 2, val = 2; x < width - 15; x += step * 2, val += 2) {
        ctx.fillText(`${val}`, x, centerY + 4);
      }
      for (let x = centerX - step * 2, val = -2; x > 15; x -= step * 2, val -= 2) {
        ctx.fillText(`${val}`, x, centerY + 4);
      }
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let y = centerY - step * 2, val = 2; y > 15; y -= step * 2, val += 2) {
        ctx.fillText(`${val}`, centerX - 4, y);
      }
      for (let y = centerY + step * 2, val = -2; y < height - 15; y += step * 2, val -= 2) {
        ctx.fillText(`${val}`, centerX - 4, y);
      }
      ctx.fillText("0", centerX - 4, centerY + 4);

      ctx.restore();
    } else if (template === "number_line") {
      ctx.save();
      const centerY = height / 2;
      const paddingX = 40;
      const lineLength = width - paddingX * 2;
      const tickCount = 20; // -10 to +10
      const step = lineLength / tickCount;

      // Line
      ctx.strokeStyle = "rgba(251, 191, 36, 0.75)"; // amber
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(paddingX - 10, centerY);
      ctx.lineTo(width - paddingX + 10, centerY);
      ctx.stroke();

      // Arrows
      ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
      // Left Arrow
      ctx.beginPath();
      ctx.moveTo(paddingX - 10, centerY);
      ctx.lineTo(paddingX - 4, centerY - 6);
      ctx.lineTo(paddingX - 4, centerY + 6);
      ctx.fill();
      // Right Arrow
      ctx.beginPath();
      ctx.moveTo(width - paddingX + 10, centerY);
      ctx.lineTo(width - paddingX + 4, centerY - 6);
      ctx.lineTo(width - paddingX + 4, centerY + 6);
      ctx.fill();

      // Ticks and numbers
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      for (let i = 0; i <= tickCount; i++) {
        const x = paddingX + i * step;
        const num = i - 10; // -10 to +10
        const isMajor = num % 5 === 0;

        ctx.strokeStyle = isMajor ? "rgba(251, 191, 36, 0.9)" : "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = isMajor ? 2 : 1;

        const tickHeight = isMajor ? 12 : 7;
        ctx.beginPath();
        ctx.moveTo(x, centerY - tickHeight);
        ctx.lineTo(x, centerY + tickHeight);
        ctx.stroke();

        if (isMajor || num % 2 === 0) {
          ctx.fillStyle = isMajor ? "#fbbf24" : "rgba(255, 255, 255, 0.7)";
          ctx.fillText(`${num}`, x, centerY + 16);
        }
      }
      ctx.restore();
    }
  };

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 640;
        canvas.height = 320;
        renderBackground(ctx, canvas.width, canvas.height, selectedTemplate);
      }
    }
  }, [isOpen]);

  const handleSelectTemplate = (template: WhiteboardTemplate) => {
    playSound("pop");
    setSelectedTemplate(template);
    setIsDropdownOpen(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        renderBackground(ctx, canvas.width, canvas.height, template);
      }
    }
  };

  if (!isOpen) return null;

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    ctx.beginPath();
    ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    ctx.strokeStyle = isEraser ? "#050505" : color;
    ctx.lineWidth = isEraser ? 20 : lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    playSound("clink");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderBackground(ctx, canvas.width, canvas.height, selectedTemplate);
  };

  const handleSubmit = () => {
    playSound("pop");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageBase64 = canvas.toDataURL("image/png");
    onAnalyzeDrawing(imageBase64);
  };

  const currentTemplateObj =
    TEMPLATE_OPTIONS.find((t) => t.id === selectedTemplate) || TEMPLATE_OPTIONS[0];
  const CurrentTemplateIcon = currentTemplateObj.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-[#0a0a0a] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-black/60 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
            <h3 className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-white truncate">
              SCRATCHPAD: {currentProblemTitle || "Math Work"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawing Canvas Area */}
        <div className="p-3 sm:p-5 bg-black/40 flex flex-col items-center">
          <canvas
            ref={canvasRef}
            width={640}
            height={320}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-64 sm:h-80 bg-[#050505] border border-white/10 rounded-xl sm:rounded-2xl cursor-crosshair shadow-inner touch-none"
          />

          {/* Color & Pen Controls + Template Dropdown */}
          <div className="flex flex-wrap items-center justify-between w-full mt-3 sm:mt-4 px-1 gap-2.5 font-mono">
            {/* Left Controls: Pen / Eraser / Colors */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setIsEraser(false);
                  playSound("pop");
                }}
                className={`px-2.5 py-1.5 sm:p-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  !isEraser ? "bg-cyan-400/20 text-cyan-400 border-cyan-400/40" : "bg-white/5 text-gray-400 border-white/10"
                }`}
              >
                <Pen className="w-3.5 h-3.5" /> Pen
              </button>

              <button
                onClick={() => {
                  setIsEraser(true);
                  playSound("pop");
                }}
                className={`px-2.5 py-1.5 sm:p-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  isEraser ? "bg-cyan-400/20 text-cyan-400 border-cyan-400/40" : "bg-white/5 text-gray-400 border-white/10"
                }`}
              >
                <Eraser className="w-3.5 h-3.5" /> Eraser
              </button>

              {/* Color Pickers */}
              <div className="flex items-center gap-1.5 sm:gap-2 ml-0.5 sm:ml-1">
                {["#22d3ee", "#34d399", "#fbbf24", "#f43f5e", "#ffffff"].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setColor(c);
                      setIsEraser(false);
                    }}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 transition ${
                      color === c && !isEraser ? "border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "border-transparent opacity-80"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Right Controls: Background Template Dropdown & Clear */}
            <div className="flex items-center gap-2">
              {/* Background Template Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    playSound("pop");
                    setIsDropdownOpen(!isDropdownOpen);
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider border border-white/10 transition-all hover:border-cyan-400/40"
                >
                  <LayoutTemplate className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline text-gray-400">Template:</span>
                  <span className="text-cyan-300 font-bold">{currentTemplateObj.name}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-56 bg-[#0e0e0e] border border-white/15 rounded-2xl shadow-2xl p-1.5 z-50 backdrop-blur-xl animate-fadeIn space-y-1">
                    <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 border-b border-white/10 mb-1 flex items-center gap-1.5">
                      <LayoutTemplate className="w-3 h-3 text-cyan-400" /> Canvas Background
                    </div>
                    {TEMPLATE_OPTIONS.map((tpl) => {
                      const Icon = tpl.icon;
                      const isSelected = selectedTemplate === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          onClick={() => handleSelectTemplate(tpl.id)}
                          className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-all ${
                            isSelected
                              ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 font-bold"
                              : "text-gray-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 ${isSelected ? "text-cyan-400" : "text-gray-400"}`} />
                            <div>
                              <span className="text-xs block leading-tight">{tpl.name}</span>
                              <span className="text-[9px] text-gray-400 font-sans leading-tight block">
                                {tpl.desc}
                              </span>
                            </div>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={clearCanvas}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-white/10"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          </div>
        </div>

        {/* AI Feedback Display Box */}
        {aiFeedback && (
          <div className="mx-3 sm:mx-5 mb-3 p-3.5 sm:p-4 bg-cyan-400/10 border border-cyan-400/30 rounded-2xl text-xs text-cyan-100 font-mono">
            <span className="font-bold text-cyan-400 block uppercase tracking-wider mb-1">Koda's Whiteboard Diagnostic:</span>
            {aiFeedback}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-black border-t border-white/10 gap-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 text-center sm:text-left">
            Draw your equations, fractions, or diagrams
          </span>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-black font-bold font-mono text-xs uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.4)] transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Sparkles className="w-4 h-4 animate-spin text-black" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Analyze Work
          </button>
        </div>
      </div>
    </div>
  );
};

