import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, MicOff, Volume2, VolumeX, Lightbulb, Sparkles } from "lucide-react";
import { ChatMessage } from "../types";
import { playSound, playBase64Pcm } from "../utils/audio";

interface SocraticChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onRequestHint: () => void;
  isLoading: boolean;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
}

export const SocraticChatPanel: React.FC<SocraticChatPanelProps> = ({
  messages,
  onSendMessage,
  onRequestHint,
  isLoading,
  voiceEnabled,
  onToggleVoice,
}) => {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    playSound("pop");
    onSendMessage(input.trim());
    setInput("");
  };

  // Speech Recognition (Web Speech API)
  const toggleSpeechToText = () => {
    playSound("pop");
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please type your message.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  return (
    <div className="flex flex-col h-[520px] bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl overflow-hidden backdrop-blur-sm">
      {/* Top Bar Controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Socratic AI Coach
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleVoice}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
              voiceEnabled
                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                : "bg-slate-900 text-slate-500 border-slate-800"
            }`}
            title="Toggle Voice Speech"
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{voiceEnabled ? "Voice ON" : "Voice OFF"}</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Feed */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
        {messages.map((msg) => {
          const isSora = msg.sender === "sora" || msg.sender === "koda";
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isSora ? "justify-start" : "justify-end"}`}
            >
              {isSora && (
                <div className="w-7 h-7 shrink-0 bg-cyan-500/20 rounded-lg flex items-center justify-center border border-cyan-400/40 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                </div>
              )}

              <div
                className={`max-w-[85%] p-3.5 text-xs sm:text-sm leading-relaxed ${
                  isSora
                    ? "bg-slate-950/90 text-slate-200 rounded-2xl rounded-tl-sm border border-slate-800/80"
                    : "bg-cyan-600 text-white rounded-2xl rounded-tr-sm shadow-md"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between gap-3">
                  <span className={isSora ? "text-cyan-400 font-bold" : "text-cyan-100"}>
                    {isSora ? "Koda AI" : "You"}
                  </span>
                  {msg.xpEarned ? (
                    <span className="text-amber-400 font-mono font-bold text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                      +{msg.xpEarned} XP
                    </span>
                  ) : null}
                </div>

                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2.5 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 w-fit text-xs text-cyan-400">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-medium">Koda is thinking...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Socratic Quick Hint / Inquiry Pills */}
      <div className="px-3 py-2 bg-slate-950/90 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => {
            playSound("hint");
            onRequestHint();
          }}
          className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium whitespace-nowrap transition"
        >
          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
          Hint
        </button>

        <button
          onClick={() => onSendMessage("Why does this mathematical model work this way?")}
          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs font-medium whitespace-nowrap transition"
        >
          💡 Why does this work?
        </button>

        <button
          onClick={() => onSendMessage("Can you give me a visual clue?")}
          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs font-medium whitespace-nowrap transition"
        >
          🔍 Visual clue
        </button>
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleSpeechToText}
          className={`p-2 rounded-xl border transition ${
            isListening
              ? "bg-red-500/20 text-red-400 border-red-500/50 animate-pulse"
              : "bg-slate-900 text-slate-400 hover:text-white border-slate-800"
          }`}
          title="Microphone Speech-to-Text"
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Listening... speak clearly..." : "Ask a question or explain your reasoning..."}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
        />

        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl shadow-md disabled:opacity-40 transition active:scale-95 flex items-center justify-center shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
