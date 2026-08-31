import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  RefreshCw,
  Radio,
  MessageSquare,
  ChevronDown,
  Info,
  Play,
  Award,
  Zap,
  HelpCircle,
  Bot,
  Maximize2,
  Minimize2,
  GripHorizontal,
  Keyboard,
  Lightbulb,
  Wrench,
  Brain,
  ArrowRight,
} from "lucide-react";
import { GeminiLiveVoiceSession, LiveVoiceConfig } from "../utils/geminiLiveAudio";
import { usePersona } from "../lib/usePersona";
import { KodaMascot } from "./KodaMascot";
import { KODA_BRAND } from "./KodaFace";
import { liveCaption, mascotStateFor } from "../lib/kodaLive";
import { KodaConversation } from "../lib/koda/conversationLog";

interface LiveVoiceCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTopic?: string;
  currentLevel?: number;
  currentQuestionText?: string;
  currentQuestionIndex?: number;
  totalQuestions?: number;
  currentProblemContext?: string;
  studentName?: string;
  onAwardXp?: (xp: number) => void;
  onNextQuestion?: () => void;
  /**
   * Leave the spoken session and carry on in writing.
   *
   * The way back out, now that a tap on Ask Koda opens this rather than the
   * written panel: a child in a quiet room, a classroom, or one who simply
   * would rather type must not have to close Koda and hunt for the other half.
   * Omitted where there is no other half — a deployment with written help
   * switched off draws no button for a panel that would refuse.
   */
  onSwitchToText?: () => void;
}

export const LiveVoiceCoachModal: React.FC<LiveVoiceCoachModalProps> = ({
  isOpen,
  onClose,
  currentTopic = "Counting to 100 & Number Sense",
  currentLevel = 1,
  currentQuestionText = "Count the items on screen or solve the pattern to find the total.",
  currentQuestionIndex = 1,
  totalQuestions = 5,
  currentProblemContext = "Exploring ten-frames, counting on, and base-10 number blocks.",
  studentName = "Math Explorer",
  onAwardXp,
  onNextQuestion,
  onSwitchToText,
}) => {
  const [sessionStatus, setSessionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "speaking" | "listening" | "error"
  >("disconnected");
  /*
   * Who is teaching, and therefore which voice speaks.
   *
   * The picker still exists — a child changing Koda's voice mid-session is part
   * of the coach — but it *starts* on the character's own voice rather than on
   * a hard-coded "Aoede", so a family that chose Ms Vega hears Ms Vega.
   */
  const character = usePersona();
  const [selectedVoice, setSelectedVoice] = useState<
    "Aoede" | "Puck" | "Kore" | "Fenrir" | "Zephyr"
  >(character.voice as "Aoede");

  // Follow the character when it changes, unless a session is already running
  // in a voice somebody picked on purpose.
  useEffect(() => {
    if (sessionStatus === "disconnected") setSelectedVoice(character.voice as "Aoede");
  }, [character.personaId]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  // Reset position when toggling expanded view or closing/opening
  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, [isExpanded, isOpen]);

  // Dragging logic for mouse and touch events
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isExpanded) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("select") || target.closest("input")) {
      return;
    }
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    setIsDragging(true);
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.startX;
      const deltaY = e.clientY - dragStartRef.current.startY;
      setPosition({
        x: dragStartRef.current.initialX + deltaX,
        y: dragStartRef.current.initialY + deltaY,
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - dragStartRef.current.startX;
        const deltaY = e.touches[0].clientY - dragStartRef.current.startY;
        setPosition({
          x: dragStartRef.current.initialX + deltaX,
          y: dragStartRef.current.initialY + deltaY,
        });
      }
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleDragEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging]);

  // Real-time energy levels (0 to 1) for animated audio orb visualizer
  const [userEnergy, setUserEnergy] = useState<number>(0);
  const [modelEnergy, setModelEnergy] = useState<number>(0);
  const [isWebSpeechSpeaking, setIsWebSpeechSpeaking] = useState<boolean>(false);

  // Sync animation state with Web Speech API Synthesis speaking state
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    
    let intervalId: any;
    
    const checkSpeaking = () => {
      const currentlySpeaking = window.speechSynthesis.speaking;
      setIsWebSpeechSpeaking(currentlySpeaking);
      
      if (currentlySpeaking) {
        // Generate a beautifully fluctuating energy level for organic speaking motion
        const time = Date.now() / 120;
        const baseEnergy = 0.2 + Math.sin(time) * 0.15 + Math.cos(time * 0.7) * 0.08;
        setModelEnergy(Math.max(0.05, Math.min(0.5, baseEnergy)));
      } else {
        // Do not zero it if Gemini Live voice session is actively speaking
        if (sessionStatus !== "speaking") {
          setModelEnergy(0);
        }
      }
    };
    
    // Poll the native Web Speech synthesis status frequently for tight UI syncing
    intervalId = setInterval(checkSpeaking, 80);
    return () => {
      clearInterval(intervalId);
    };
  }, [sessionStatus]);

  // Live transcript messages
  const [transcript, setTranscript] = useState<
    Array<{ id: string; sender: "user" | "koda"; text: string; time: string }>
  >([]);

  // Text input for hybrid typing
  const [textInput, setTextInput] = useState<string>("");

  const sessionRef = useRef<GeminiLiveVoiceSession | null>(null);
  /** What this conversation is recording. Written when the coach closes. */
  const conversationRef = useRef<KodaConversation | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const lastNextQuestionTimeRef = useRef<number>(0);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Auto-connect when modal opens
  useEffect(() => {
    if (isOpen && sessionStatus === "disconnected" && !sessionRef.current) {
      handleToggleLiveSession();
    }
  }, [isOpen]);

  // Dynamically update Koda when active question changes on screen
  useEffect(() => {
    if (sessionRef.current && sessionStatus !== "disconnected" && currentQuestionText) {
      // Not over the top of him: a new turn makes the model abandon the one it
      // is in, and this fires exactly when Koda is most likely mid-sentence
      // about the question the child has just left.
      sessionRef.current.sendTextWhenIdle(
        `[SYSTEM NOTE: Student moved to Question ${currentQuestionIndex} of ${totalQuestions}: "${currentQuestionText}". Address this new question for the student now!]`
      );
    }
  }, [currentQuestionIndex, currentQuestionText]);

  // Handle Start / Stop Live Session
  const handleToggleLiveSession = async () => {
    if (sessionStatus === "connected" || sessionStatus === "speaking" || sessionStatus === "listening") {
      // Disconnect
      if (sessionRef.current) {
        sessionRef.current.stop();
        sessionRef.current = null;
      }
      // Stopping the session ends the conversation, exactly as closing the
      // panel does. This was the one way out that recorded nothing.
      conversationRef.current?.end();
      conversationRef.current = null;
      setSessionStatus("disconnected");
    } else {
      // Connect
      setErrorMessage(null);
      const config: LiveVoiceConfig = {
        voice: selectedVoice,
        topic: currentTopic,
        level: currentLevel,
        context: currentProblemContext,
        question: currentQuestionText,
      };

      const session = new GeminiLiveVoiceSession(config, {
        onStatusChange: (status) => {
          setSessionStatus(status);
          if (status === "connected") {
            onAwardXp?.(15);
          }
        },
        onModelText: (text) => {
          // Detect if Koda instructed to move to the next question
          const lower = text.toLowerCase();
          if (
            lower.includes("next question") ||
            lower.includes("next problem") ||
            lower.includes("move to the next") ||
            lower.includes("moving to the next") ||
            lower.includes("try the next question")
          ) {
            const now = Date.now();
            if (now - lastNextQuestionTimeRef.current > 3500) {
              lastNextQuestionTimeRef.current = now;
              console.log("Koda said 'next question', triggering onNextQuestion()");
              onNextQuestion?.();
            }
          }

          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.sender === "koda") {
              return [
                ...prev.slice(0, -1),
                { ...last, text: last.text + text },
              ];
            } else {
              return [
                ...prev,
                {
                  id: `koda_${Date.now()}`,
                  sender: "koda",
                  text: text,
                  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                },
              ];
            }
          });
        },
        onUserText: (text) => {
          // The child's own words. Koda's replies are deliberately not recorded.
          conversationRef.current?.said(text);
          setTranscript((prev) => [
            ...prev,
            {
              id: `user_${Date.now()}`,
              sender: "user",
              text: text,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);

          // Check for vocal commands to hide/close the coach
          const lower = text.toLowerCase();
          if (
            lower.includes("visible") ||
            lower.includes("invisible") ||
            lower.includes("disappear") ||
            lower.includes("close koda") ||
            lower.includes("hide koda") ||
            lower.includes("go away")
          ) {
            setTimeout(() => {
              onClose();
            }, 800);
          }
        },
        onAudioEnergy: (uEnergy, mEnergy) => {
          setUserEnergy(uEnergy);
          setModelEnergy(mEnergy);
        },
        onError: (err) => {
          setErrorMessage(err);
        },
        onInterrupted: () => {
          // Visual feedback for speech interruption
        },
      });

      sessionRef.current = session;
      /*
       * The record of this conversation, opened with the session.
       *
       * Its own object rather than something the session owns: what is worth
       * recording is a property of the exchange, not of the socket, and the
       * socket already has enough to do. Written once, when the coach closes.
       */
      conversationRef.current = new KodaConversation({
        mode: "voice",
        personaId: character.personaId,
        // What this coach is given. It is opened from anywhere — including
        // screens with no lesson at all — so the topic is often all there is,
        // and the event's fields are optional for exactly that reason.
        conceptKey: currentTopic,
        levelNumber: currentLevel,
      });
      await session.start();
    }
  };

  // Stop when the modal closes.
  useEffect(() => {
    if (!isOpen && sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
      conversationRef.current?.end();
      conversationRef.current = null;
      setSessionStatus("disconnected");
    }
  }, [isOpen]);

  /**
   * Stop when the component goes away.
   *
   * The close path above only fires while this component is still mounted.
   * Leaving the round, or the host remounting it, tore the modal down without
   * ever calling `stop()` — so the microphone stayed open and Koda carried on
   * talking over the next screen. Runs once, and reads the session through the
   * ref so it always stops the live one.
   */
  useEffect(() => {
    return () => {
      sessionRef.current?.stop();
      conversationRef.current?.end();
      conversationRef.current = null;
      sessionRef.current = null;
    };
  }, []);

  // Quick Questions
  const handleQuickPrompt = (promptText: string) => {
    if (sessionRef.current && sessionStatus !== "disconnected") {
      setTranscript((prev) => [
        ...prev,
        {
          id: `user_${Date.now()}`,
          sender: "user",
          text: promptText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      const lower = promptText.toLowerCase();
      if (
        lower.includes("visible") ||
        lower.includes("invisible") ||
        lower.includes("disappear") ||
        lower.includes("close koda") ||
        lower.includes("hide koda") ||
        lower.includes("go away")
      ) {
        setTimeout(() => {
          onClose();
        }, 800);
        return;
      }

      sessionRef.current.sendTextMessage(promptText);
    } else {
      // Prompt user to connect first
      handleToggleLiveSession();
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const msg = textInput.trim();
    setTextInput("");
    handleQuickPrompt(msg);
  };

  if (!isOpen) return null;

  const isKodaSpeaking = sessionStatus === "speaking" || isWebSpeechSpeaking;

  /*
   * What the session is doing, as one answer.
   *
   * Derived here rather than at each place that draws something, so the face,
   * the status pill and the caption cannot disagree — they used to be three
   * separate ternaries over `sessionStatus`, which is how a modal ends up
   * saying "Listening…" beside a mouth that is talking.
   */
  const liveState = mascotStateFor({
    status: sessionStatus,
    userEnergy,
    modelEnergy,
    muted: isMuted,
    fallbackSpeaking: isWebSpeechSpeaking,
  });

  const isLiveActive =
    sessionStatus === "connected" || sessionStatus === "speaking" || sessionStatus === "listening" || isWebSpeechSpeaking;

  // Orb dynamic scale and glow based on energy
  const orbScale = isLiveActive
    ? isKodaSpeaking
      ? 1 + modelEnergy * 0.35
      : 1 + userEnergy * 0.25
    : 1;

  const orbGlow = isLiveActive
    ? isKodaSpeaking
      ? "shadow-[0_0_60px_rgba(34,211,238,0.8)] ring-4 ring-cyan-400/60"
      : "shadow-[0_0_50px_rgba(251,191,36,0.7)] ring-4 ring-violet-500/50"
    : "shadow-[0_0_25px_rgba(100,116,139,0.3)] ring-2 ring-line";

  return (
    <>
      {/* Dynamic Keyframe Styles injected directly */}
      <style>{`
        @keyframes kodaFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes ringPulse {
          0% {
            transform: scale(0.95);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }
        .animate-kodaFloat {
          animation: kodaFloat 4s ease-in-out infinite;
        }
        .animate-ringPulse {
          animation: ringPulse 2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
      `}</style>

      {isExpanded ? (
        /* ============================================================ */
        /* EXPANDED FULL COACHING DASHBOARD                            */
        /* ============================================================ */
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-surface border-2 border-violet-600/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] pointer-events-auto">
            {/* Header */}
            <div className="px-3.5 sm:px-4 py-2.5 bg-gradient-to-r from-surface via-violet-500/10 to-surface border-b border-violet-500/20 flex items-center justify-between gap-2 shrink-0 select-none">
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-violet-500 via-orange-400 to-violet-600 text-white shadow-md shrink-0">
                  <Bot className="w-4 h-4" />
                  {isLiveActive && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <h2 className="text-xs sm:text-sm font-black text-ink tracking-wide truncate">
                    {character.name}
                  </h2>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30 shrink-0">
                    Live
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={selectedVoice}
                  disabled={isLiveActive}
                  onChange={(e) => setSelectedVoice(e.target.value as any)}
                  className="bg-surface-muted/90 border border-line text-ink text-[11px] font-medium rounded-lg px-2 py-1 focus:outline-none focus:border-violet-500 cursor-pointer max-w-[130px] truncate"
                  title="Select Koda Voice"
                >
                  <option value="Aoede">Aoede (Warm)</option>
                  <option value="Puck">Puck (Fun)</option>
                  <option value="Kore">Kore (Calm)</option>
                  <option value="Fenrir">Fenrir (Deep)</option>
                  <option value="Zephyr">Zephyr (Tutor)</option>
                </select>

                {onSwitchToText && (
                  <button
                    onClick={onSwitchToText}
                    className="p-1.5 rounded-xl bg-surface-muted/80 hover:bg-surface-muted text-muted hover:text-ink transition cursor-pointer"
                    title="Type to Koda instead"
                    aria-label="Type to Koda instead"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 rounded-xl bg-surface-muted/80 hover:bg-surface-muted text-muted hover:text-ink transition cursor-pointer"
                  title="Floating Pop-up Mode"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-xl bg-surface-muted/80 hover:bg-surface-muted text-muted hover:text-ink transition cursor-pointer"
                  title="Close Voice Coach"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scrollable Main Container */}
            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
              {/* Active Question Context Card */}
              <div className="mx-3 sm:mx-4 my-2.5 p-3 bg-canvas/90 border border-violet-500/30 rounded-2xl shadow-md flex items-start gap-2.5 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-400/30 flex items-center justify-center shrink-0 text-violet-500 mt-0.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-violet-500">
                      Question {currentQuestionIndex ? `${currentQuestionIndex}/${totalQuestions}` : ""}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-ink mt-0.5 leading-snug">
                    {currentQuestionText}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 self-center">
                  <button
                    onClick={() => handleQuickPrompt(`Hi ${character.name}! Can you give me a hint to help me solve this question: "${currentQuestionText}"?`)}
                    className="px-2 py-1 rounded-xl bg-violet-400/20 hover:bg-violet-400/30 border border-violet-500/40 text-[10px] font-mono font-bold text-violet-500 hover:text-violet-700 transition cursor-pointer"
                  >
                    Ask Hint
                  </button>
                  {onNextQuestion && (
                    <button
                      onClick={() => {
                        onNextQuestion();
                        handleQuickPrompt(`Let's move to the next question!`);
                      }}
                      className="px-2 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-[10px] font-mono font-bold text-cyan-600 hover:text-cyan-800 transition cursor-pointer flex items-center gap-1"
                      title="Move to the next question"
                    >
                      <span>Next Question</span>
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* Central Koda Avatar Stage */}
              <div className="relative py-4 px-4 bg-gradient-to-b from-surface via-surface to-canvas flex flex-col items-center justify-center border-b border-line/80 shrink-0">
                {/*
                  * No disc behind the character.
                  *
                  * There were two, scaling with the audio — a coloured circle
                  * pulsing under a face that is already breathing, blinking and
                  * moving its mouth. Two things animating the same signal read
                  * as decoration fighting the character, and the circle won
                  * because it was bigger. The mascot carries the state on its
                  * own; the pill underneath names it in words.
                  */}
                <div className="relative flex items-center justify-center">

                  {/*
                    * The character the family chose, driven by the session.
                    *
                    * This was a hand-built orb — glowing eyes, a bar for a
                    * mouth — which meant Koda had a third face nobody had
                    * picked, in the one place a child is actually talking to
                    * them. The mascot follows `mascotStateFor`, and its mouth
                    * follows Koda's own volume, so what is on screen is what
                    * the session is doing rather than a decoration beside it.
                    */}
                  <button
                    type="button"
                    onClick={handleToggleLiveSession}
                    aria-label={isLiveActive ? "End the voice session" : "Start the voice session"}
                    className="relative z-10 cursor-pointer rounded-2xl transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    style={{ transform: `scale(${orbScale})`, transition: "transform 0.08s ease-out" }}
                  >
                    <KodaMascot
                      state={liveState}
                      personaId={character.personaId}
                      avatarSeed={character.avatarSeed}
                      palette={KODA_BRAND}
                      energy={liveState === "speaking" ? modelEnergy : undefined}
                      size={96}
                    />
                  </button>
                </div>

                {/*
                  * Only what the face cannot say.
                  *
                  * The pill used to narrate "Koda is speaking", "Listening…",
                  * "Thinking…" — beside a character that was already speaking,
                  * listening and thinking. Two things saying the same thing, and
                  * a child reads the animation first.
                  *
                  * What is left is the three states an animation genuinely
                  * cannot express: a session that failed, a session that has not
                  * started, and a microphone that is off. A mascot with a closed
                  * mouth cannot tell a child which of those is true, and "tap me
                  * to start" is the one instruction on this screen.
                  *
                  * The live state stays in an aria-live region, because a face is
                  * not available to a screen reader at all.
                  */}
                <div className="mt-3 text-center">
                  <span className="sr-only" aria-live="polite">
                    {liveCaption(liveState, character.name)}
                  </span>
                  {(sessionStatus === "error" ||
                    sessionStatus === "disconnected" ||
                    (isMuted && liveState !== "speaking")) && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-surface-muted/90 border border-line/80 shadow-sm">
                      <span className="text-[11px] font-bold text-ink">
                        {sessionStatus === "error"
                          ? "Connection Error"
                          : sessionStatus === "disconnected"
                            ? `Tap ${character.name} to start`
                            : "Microphone off"}
                      </span>
                    </div>
                  )}
                  {errorMessage && (
                    <p className="mt-1.5 text-[11px] text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-xl px-2.5 py-1 max-w-xs mx-auto">
                      {errorMessage}
                    </p>
                  )}
                </div>

                {/* Action Bar */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleToggleLiveSession}
                    className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md transition transform active:scale-95 cursor-pointer ${
                      isLiveActive
                        ? "bg-rose-500 hover:bg-rose-600 text-white"
                        : "bg-gradient-to-r from-violet-500 to-orange-500 hover:from-violet-400 hover:to-orange-400 text-white"
                    }`}
                  >
                    {isLiveActive ? (
                      <>
                        <Radio className="w-3.5 h-3.5" />
                        <span>End Voice</span>
                      </>
                    ) : (
                      <>
                        <Radio className="w-3.5 h-3.5" />
                        <span>Start Live Voice</span>
                      </>
                    )}
                  </button>

                  {isLiveActive && (
                    <button
                      onClick={() => {
                        if (sessionRef.current) {
                          const muted = sessionRef.current.toggleMute();
                          setIsMuted(muted);
                        }
                      }}
                      className={`p-2 rounded-xl border transition cursor-pointer ${
                        isMuted
                          ? "bg-rose-950/60 border-rose-500/50 text-rose-300"
                          : "bg-surface-muted/80 border-line text-muted hover:text-ink"
                      }`}
                      title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                    >
                      {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Socratic Prompts */}
              <div className="px-3 py-2 bg-canvas/50 border-b border-line/80 shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  <button
                    onClick={() => handleQuickPrompt(`Can you give me a hint for Question ${currentQuestionIndex}?`)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-muted/80 hover:bg-surface-muted border border-line text-[11px] font-medium text-muted hover:text-violet-500 hover:border-violet-400 transition whitespace-nowrap cursor-pointer shrink-0"
                  >
                    <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                    Hint Q{currentQuestionIndex}
                  </button>
                  <button
                    onClick={() => handleQuickPrompt(`How do I use the visual tools on screen?`)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-muted/80 hover:bg-surface-muted border border-line text-[11px] font-medium text-muted hover:text-violet-500 hover:border-violet-400 transition whitespace-nowrap cursor-pointer shrink-0"
                  >
                    <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                    Visual Tools
                  </button>
                  <button
                    onClick={() => handleQuickPrompt(`Can you explain the main math concept here?`)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-muted/80 hover:bg-surface-muted border border-line text-[11px] font-medium text-muted hover:text-violet-500 hover:border-violet-400 transition whitespace-nowrap cursor-pointer shrink-0"
                  >
                    <Brain className="h-3.5 w-3.5" aria-hidden="true" />
                    Concept
                  </button>
                </div>
              </div>

              {/* Live Conversation Transcript */}
              <div className="flex-1 p-3 overflow-y-auto min-h-[100px] max-h-[180px] space-y-2 bg-surface/60">
                {transcript.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-4 text-muted">
                    <MessageSquare className="w-6 h-6 mb-1 opacity-40 text-violet-500" />
                    <p className="text-[11px] font-medium text-muted">Live Voice Transcripts</p>
                  </div>
                ) : (
                  transcript.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.sender === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-0.5 px-1">
                        <span className="text-[9px] font-bold text-muted">
                          {msg.sender === "user" ? studentName : "Koda"}
                        </span>
                        <span className="text-[8px] text-muted">{msg.time}</span>
                      </div>
                      <div
                        className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                          msg.sender === "user"
                            ? "bg-violet-600 text-white font-medium rounded-tr-none"
                            : "bg-surface-muted border border-line text-ink rounded-tl-none"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>

            {/* Text Input Footer */}
            <form
              onSubmit={handleSendText}
              className="p-3 bg-canvas border-t border-line flex items-center gap-2"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type or speak a question to Koda..."
                className="flex-1 bg-surface border border-line focus:border-violet-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink placeholder:text-muted focus:outline-none"
              />
              <button
                type="submit"
                disabled={!textInput.trim()}
                className="px-4 py-2 bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* FLOATING MINIMALIST ORB VIEW (JUST KODA ALONE - NO BOX)      */
        /* ============================================================ */
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-end justify-end p-4 sm:p-6 pb-24 sm:pb-28">
          <div
            style={{
              transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
              transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            className="pointer-events-auto relative flex flex-col items-center justify-center animate-kodaFloat"
          >
            {/*
              * No speech bubble. Koda is talking — the words are already in the
              * room, and a caption of them was a 290px panel of low-contrast
              * text floating over whatever the child was meant to be looking
              * at. The transcript in the open panel is where anyone who wants
              * the words can read them.
              */}
            {/* Drag Handle & Hover Area Wrapper */}
            <div 
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              className="relative group flex items-center justify-center w-28 h-28 cursor-grab active:cursor-grabbing select-none"
              title="Click and drag to move Koda anywhere!"
            >
              {/*
                * The character, with nothing drawn around it.
                *
                * This was a bordered, gradient-filled disc that changed colour
                * with the session — a second, cruder status indicator wrapped
                * around a face that already shows the same thing by talking,
                * listening or waiting. Cutting it out leaves the character
                * sitting on the page rather than in a badge, which is also what
                * the mascot's transparent background was designed for.
                */}
              <div
                style={{
                  transform: `scale(${orbScale})`,
                  transition: "transform 0.08s ease-out",
                }}
                className="relative z-10 flex flex-col items-center justify-center w-20 h-20 rounded-full transition-transform duration-300"
                onClick={handleToggleLiveSession}
                title={isLiveActive ? "Voice is ACTIVE! Click to pause/disconnect." : "Voice is offline. Click to connect!"}
              >
                {/*
                  * The character, not a drawing of one.
                  *
                  * This used to be a face built here out of divs — two dots, a
                  * bar for a mouth, a pair of antennas — with its own idea of
                  * which colour meant talking. So the floating coach and the
                  * panel showed two different Kodas, and the small one was the
                  * one a child looks at most.
                  *
                  * `KodaMascot` is the same character the panel draws, on the
                  * same `mascotStateFor` reading, so talking, listening,
                  * thinking and waiting look identical in both places.
                  */}
                <KodaMascot
                  state={liveState}
                  personaId={character.personaId}
                  avatarSeed={character.avatarSeed}
                  palette={KODA_BRAND}
                  energy={isKodaSpeaking ? modelEnergy : undefined}
                  size={68}
                />

                <Sparkles className="absolute top-1.5 right-1.5 w-2 h-2 text-violet-500 opacity-80" />
              </div>

              {/*
                * No status dot. It pulsed a colour for speaking, listening and
                * connected — three things the character beside it is already
                * doing, on a shape small enough that the dot was competing with
                * the face for the same 80 pixels.
                */}
            </div>

            {/* Float Menu Controls Pill (Mouth/Chin area capsule) */}
            <div className="absolute -bottom-8 flex items-center gap-1.5 bg-canvas/90 border border-violet-500/30 rounded-full px-2 py-1 shadow-lg pointer-events-auto shrink-0 opacity-80 hover:opacity-100 transition-opacity">
              {/* Mic Status */}
              <button
                onClick={handleToggleLiveSession}
                className={`p-1.5 rounded-full transition transform active:scale-90 cursor-pointer ${
                  isLiveActive ? "text-cyan-400 hover:text-cyan-300" : "text-muted hover:text-violet-500"
                }`}
                title={isLiveActive ? "Disconnect Session" : "Connect Session"}
              >
                <Radio className="w-3.5 h-3.5" />
              </button>

              {isLiveActive && (
                <button
                  onClick={() => {
                    if (sessionRef.current) {
                      const muted = sessionRef.current.toggleMute();
                      setIsMuted(muted);
                    }
                  }}
                  className={`p-1.5 rounded-full transition transform active:scale-90 cursor-pointer ${
                    isMuted ? "text-rose-400 hover:text-rose-300" : "text-muted hover:text-ink"
                  }`}
                  title={isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
              )}

              {onSwitchToText && (
                <button
                  onClick={onSwitchToText}
                  className="p-1.5 text-muted hover:text-ink rounded-full transition transform active:scale-90 cursor-pointer"
                  title="Type to Koda instead"
                  aria-label="Type to Koda instead"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-1.5 text-rose-400 hover:text-rose-300 rounded-full transition transform active:scale-90 cursor-pointer"
                title="Close Koda Coach"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
