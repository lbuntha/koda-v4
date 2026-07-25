/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import {
  X,
  Download,
  Trash2,
  FileText,
  BarChart3,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Navigation,
  Lightbulb,
  Sparkles,
  Copy,
  Check,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { analyticsLogger } from "../services/analyticsLogger";
import { LearningEvent, LearningEventType, SkillMasterySnapshot } from "../services/logSchema";

interface AnalyticsViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

type ViewMode = "events" | "mastery";

export const AnalyticsViewerModal: React.FC<AnalyticsViewerModalProps> = ({
  isOpen,
  onClose,
  isDark
}) => {
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [summary, setSummary] = useState(analyticsLogger.getSummary());
  const [mastery, setMastery] = useState<SkillMasterySnapshot[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("events");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = analyticsLogger.subscribe((updated) => {
      setEvents([...updated]);
      setSummary(analyticsLogger.getSummary());
      setMastery(analyticsLogger.getSkillMastery());
    });

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredEvents = events.filter((e) => {
    if (filterType === "all") return true;
    if (filterType === "correct") return e.eventType === "attempt" && e.outcome === "correct";
    if (filterType === "incorrect") return e.eventType === "attempt" && e.outcome !== "correct";
    if (filterType === "navigation") return e.eventType === "slide_view" || e.eventType === "lesson_complete";
    if (filterType === "resets") return e.eventType === "slide_reset";
    if (filterType === "hints") return e.eventType === "hint_requested";
    return true;
  });

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(analyticsLogger.exportJSON());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = (content: string, mime: string, filename: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () =>
    download(analyticsLogger.exportJSON(), "application/json", `koda_learning_events_${new Date().toISOString().slice(0, 10)}.json`);
  const handleDownloadCSV = () =>
    download(analyticsLogger.exportCSV(), "text/csv;charset=utf-8;", `koda_learning_events_${new Date().toISOString().slice(0, 10)}.csv`);

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear all learning events recorded so far?")) {
      analyticsLogger.clearEvents();
    }
  };

  const getEventBadge = (event: LearningEvent) => {
    if (event.eventType === "attempt") {
      return event.outcome === "correct"
        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 size={10} /> Correct</span>
        : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30 flex items-center gap-1"><XCircle size={10} /> {event.outcome === "partial" ? "Partial" : "Incorrect"}</span>;
    }
    switch (event.eventType as LearningEventType) {
      case "slide_view":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-500 border border-blue-500/30 flex items-center gap-1"><Navigation size={10} /> Slide View</span>;
      case "slide_reset":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-1"><RotateCcw size={10} /> Reset</span>;
      case "hint_requested":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-500 border border-purple-500/30 flex items-center gap-1"><Lightbulb size={10} /> Hint</span>;
      case "lesson_complete":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-500 border border-pink-500/30 flex items-center gap-1"><Sparkles size={10} /> Completed</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">{event.eventType}</span>;
    }
  };

  const recommendationStyle = (rec: SkillMasterySnapshot["recommendation"]) => {
    switch (rec) {
      case "reinforce":
        return { icon: <TrendingDown size={12} />, label: "Needs reinforcement", cls: isDark ? "bg-rose-500/20 text-rose-400 border-rose-500/30" : "bg-rose-50 text-rose-700 border-rose-200" };
      case "practice_more":
        return { icon: <Minus size={12} />, label: "Practice more", cls: isDark ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-amber-50 text-amber-700 border-amber-200" };
      case "ready_to_advance":
        return { icon: <TrendingUp size={12} />, label: "Ready to advance", cls: isDark ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200" };
      default:
        return { icon: <Minus size={12} />, label: "Not enough data yet", cls: isDark ? "bg-slate-700/40 text-slate-400 border-slate-600/40" : "bg-slate-100 text-slate-500 border-slate-200" };
    }
  };

  const cardCls = isDark ? "bg-slate-800/50 border-slate-700/60" : "bg-slate-50 border-slate-200/80";
  const labelCls = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={`w-full max-w-5xl max-h-[88vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden transition-all ${
        isDark
          ? "bg-slate-900 border-slate-700 text-slate-100 shadow-black/80"
          : "bg-white border-slate-200 text-slate-800 shadow-xl"
      }`}>
        {/* ── Modal Header ── */}
        <div className={`px-6 py-4 border-b flex items-center justify-between gap-4 ${
          isDark ? "bg-slate-800/80 border-slate-700" : "bg-slate-50 border-slate-200"
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <Activity size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg tracking-tight">Learning Analytics</h2>
              <p className={`text-xs ${labelCls}`}>
                Standardized event log — right/wrong attempts, hints, and per-skill recommendations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isDark
                ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-600 shadow-sm"
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Summary Stats Cards ── */}
        <div className={`p-6 border-b grid grid-cols-2 sm:grid-cols-5 gap-3 ${
          isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-100"
        }`}>
          <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${cardCls}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${labelCls}`}>Total Events</span>
            <span className="text-2xl font-black text-indigo-500 mt-1">{summary.totalEvents}</span>
          </div>
          <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${cardCls}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${labelCls}`}>Correct</span>
            <span className="text-2xl font-black text-emerald-500 mt-1">{summary.correctAnswers}</span>
          </div>
          <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${cardCls}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${labelCls}`}>Incorrect</span>
            <span className="text-2xl font-black text-rose-500 mt-1">{summary.incorrectAnswers}</span>
          </div>
          <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${cardCls}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${labelCls}`}>Hints Used</span>
            <span className="text-2xl font-black text-purple-500 mt-1">{summary.totalHints}</span>
          </div>
          <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${cardCls}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${labelCls}`}>Resets</span>
            <span className="text-2xl font-black text-amber-500 mt-1">{summary.totalResets}</span>
          </div>
        </div>

        {/* ── View Mode Toggle ── */}
        <div className={`px-6 pt-3 flex items-center gap-2 border-b ${isDark ? "border-slate-800" : "border-slate-100"}`}>
          {[
            { id: "events" as const, label: "Event Log", icon: <Activity size={13} /> },
            { id: "mastery" as const, label: "Skill Recommendations", icon: <BarChart3 size={13} />, badge: mastery.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 -mb-px transition-colors cursor-pointer ${
                viewMode === tab.id
                  ? "border-indigo-500 text-indigo-500"
                  : `border-transparent ${labelCls} hover:text-indigo-400`
              }`}
            >
              {tab.icon}{tab.label}
              {!!tab.badge && <span className="text-[9px] font-mono opacity-60">({tab.badge})</span>}
            </button>
          ))}
        </div>

        {viewMode === "mastery" ? (
          /* ── Skill Mastery / Recommendations ── */
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-2.5 min-h-[300px]">
            {mastery.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-50">
                <BarChart3 size={40} className="mb-3 stroke-1" />
                <h4 className="font-bold text-sm">No attempts recorded yet</h4>
                <p className="text-xs mt-1 max-w-sm">
                  Solve or attempt a few slides — recommendations need at least 3 attempts per skill before they mean anything.
                </p>
              </div>
            ) : (
              mastery.map((m, i) => {
                const rec = recommendationStyle(m.recommendation);
                return (
                  <div key={`${m.subjectArea}-${m.skillTag}-${i}`} className={`p-3.5 rounded-2xl border flex items-center justify-between gap-4 ${
                    isDark ? "bg-slate-800/60 border-slate-700/80" : "bg-white border-slate-200"
                  }`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-extrabold ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>{m.subjectArea.replace(/_/g, " ")}</span>
                        <span className="text-[11px] font-mono opacity-60">· {m.skillTag.replace(/_/g, " ")}</span>
                      </div>
                      <p className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                        {m.correct}/{m.attempts} correct ({Math.round(m.accuracy * 100)}%) · avg {m.avgAttemptsToSolve.toFixed(1)} attempts/slide
                        {m.hintRate > 0 && ` · ${Math.round(m.hintRate * 100)}% used a hint`}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border ${rec.cls}`}>
                      {rec.icon}{rec.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <>
            {/* ── Toolbar & Filters ── */}
            <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
              isDark ? "bg-slate-800/40 border-slate-800" : "bg-slate-50/60 border-slate-200/60"
            }`}>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {[
                  { id: "all", label: "All Events" },
                  { id: "correct", label: "Correct" },
                  { id: "incorrect", label: "Incorrect" },
                  { id: "hints", label: "Hints" },
                  { id: "navigation", label: "Navigation" },
                  { id: "resets", label: "Resets" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterType(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border whitespace-nowrap ${
                      filterType === tab.id
                        ? "bg-indigo-500 text-white border-indigo-600 shadow-sm"
                        : isDark
                          ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                          : "bg-white hover:bg-slate-100 border-slate-200 text-slate-600"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyJSON}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    copied
                      ? "bg-emerald-500 text-white border-emerald-600"
                      : isDark
                        ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                        : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm"
                  }`}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? "Copied JSON!" : "Copy JSON"}</span>
                </button>

                <button
                  onClick={handleDownloadJSON}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    isDark
                      ? "bg-indigo-600/30 hover:bg-indigo-600/50 border-indigo-500/40 text-indigo-300"
                      : "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700"
                  }`}
                >
                  <Download size={13} />
                  <span>Export JSON</span>
                </button>

                <button
                  onClick={handleDownloadCSV}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    isDark
                      ? "bg-emerald-600/30 hover:bg-emerald-600/50 border-emerald-500/40 text-emerald-300"
                      : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700"
                  }`}
                >
                  <FileText size={13} />
                  <span>Export CSV</span>
                </button>

                {events.length > 0 && (
                  <button
                    onClick={handleClear}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      isDark
                        ? "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400"
                        : "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600"
                    }`}
                    title="Clear Logs"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* ── Event Log List ── */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-2.5 min-h-[300px]">
              {filteredEvents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-50">
                  <Activity size={40} className="mb-3 stroke-1" />
                  <h4 className="font-bold text-sm">No recorded events found</h4>
                  <p className="text-xs mt-1 max-w-sm">
                    Interact with the slides in Game Launcher (change slides, answer questions, use hints) to capture real-time analytics logs.
                  </p>
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-4 transition-all hover:scale-[1.005] ${
                      isDark
                        ? "bg-slate-800/60 border-slate-700/80 hover:bg-slate-800"
                        : "bg-white border-slate-200 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className={`font-mono text-[11px] px-2 py-1 rounded-lg border flex-shrink-0 ${
                        isDark ? "bg-slate-900 border-slate-700 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600 font-medium"
                      }`}>
                        {new Date(event.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-extrabold ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>
                            Slide {event.slideIndex + 1}
                          </span>
                          {getEventBadge(event)}
                          {event.technique && <span className="text-[11px] font-mono opacity-60">({event.technique})</span>}
                          {typeof event.attemptNumber === "number" && (
                            <span className="text-[10px] font-mono opacity-50">attempt #{event.attemptNumber}</span>
                          )}
                        </div>
                        <p className={`text-xs font-semibold truncate ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                          {event.actionSummary}
                        </p>
                      </div>
                    </div>

                    {(event.expected || event.selected || event.timeOnTaskMs) && (
                      <div className="flex-shrink-0 hidden md:flex items-center gap-2">
                        {event.expected && event.selected && (
                          <span className={`text-[10px] font-mono px-2.5 py-1 rounded-xl border ${
                            isDark ? "bg-slate-900/60 border-slate-700 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
                          }`}>
                            expected {String(event.expected)} → picked {String(event.selected)}
                          </span>
                        )}
                        {typeof event.timeOnTaskMs === "number" && (
                          <span className={`text-[10px] font-mono px-2 py-1 rounded-xl border ${
                            isDark ? "bg-slate-900/60 border-slate-700 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"
                          }`}>
                            {(event.timeOnTaskMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── Modal Footer ── */}
        <div className={`px-6 py-3 border-t flex items-center justify-between text-[11px] ${
          isDark ? "bg-slate-800/60 border-slate-700 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
        }`}>
          <span>
            {viewMode === "events"
              ? <>Displaying <strong>{filteredEvents.length}</strong> of <strong>{events.length}</strong> captured events</>
              : <><strong>{mastery.length}</strong> tracked skills</>
            }
          </span>
          <span>💾 Local live cache with authenticated student sessions synchronized to MongoDB</span>
        </div>
      </div>
    </div>
  );
};
