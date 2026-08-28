// Web Audio API Sound Synthesizer for gamified math interaction FX

import { PreferencesAPI } from "../lib/preferences";

// Sound is one of the family's synced preferences, not a private flag of the
// synthesiser — a parent turning the chimes off should have that hold on the
// tablet the child uses. This module keeps the audio API it always had and
// reads the answer from the store that owns it.
export function isSoundEnabled(): boolean {
  return PreferencesAPI.current().soundEnabled;
}

export function setSoundEnabled(enabled: boolean) {
  PreferencesAPI.update({ soundEnabled: enabled });
}

// Speech is a separate choice from chimes, and the two are separate switches in
// Settings. A parent who wants a silent room turns the effects off; a parent who
// wants nothing talking turns the voice off. Nothing spoken may read the chime
// preference — that is how a recorded "Nice work!" ended up muted by a switch
// labelled "Pops, chimes and fanfares".
export function isVoiceEnabled(): boolean {
  return PreferencesAPI.current().voiceEnabled;
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSound(type: "pop" | "clink" | "success" | "hint" | "levelup" | "error") {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (type === "pop") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === "clink") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === "success") {
      // Arpeggio C5 E5 G5 C6
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.09;
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
    } else if (type === "hint") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.1); // A5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "levelup") {
      // Fanfare
      const notes = [440, 554.37, 659.25, 880, 1108.73];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.1;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    } else if (type === "error") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (e) {
    // AudioContext permission silent catch
  }
}

// Play base64 PCM / Audio from Gemini TTS
export function playBase64Pcm(base64Audio: string, sampleRate = 24000) {
  try {
    const ctx = getAudioContext();
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Int16Array(len / 2);

    for (let i = 0; i < len; i += 2) {
      const low = binaryString.charCodeAt(i);
      const high = binaryString.charCodeAt(i + 1);
      bytes[i / 2] = (high << 8) | low;
    }

    const float32Data = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      float32Data[i] = bytes[i] / 32768.0;
    }

    const buffer = ctx.createBuffer(1, float32Data.length, sampleRate);
    buffer.getChannelData(0).set(float32Data);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    return source;
  } catch (err) {
    console.error("Failed to play PCM audio:", err);
  }
}

// Fallback browser speech synthesis
export function speakWebSpeech(text: string, rateOrOnEnd?: number | (() => void), onEndCallback?: () => void) {
  let rate = 1.0;
  let onEnd = onEndCallback;
  if (typeof rateOrOnEnd === "number") {
    rate = rateOrOnEnd;
  } else if (typeof rateOrOnEnd === "function") {
    onEnd = rateOrOnEnd;
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.6, Math.min(1.6, rate));
      utterance.pitch = 1.1; // Cheerful friendly pitch
      if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
      }
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      onEnd?.();
      return false;
    }
  }
  onEnd?.();
  return false;
}
