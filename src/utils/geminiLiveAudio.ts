/**
 * Gemini Live Multimodal Audio Engine (Client-side)
 * Handles:
 * 1. 16kHz microphone capture & PCM 16-bit encoding
 * 2. 24kHz gapless model response audio playback with precision time-scheduling
 * 3. Real-time amplitude metering for visual audio orb waves
 * 4. WebSocket session protocol with Gemini Live API
 */

import { currentPersonaId } from "../lib/personas";
import { tutorSocketToken } from "../lib/tutorApi";

export interface LiveVoiceConfig {
  /**
   * Override the character's own voice.
   *
   * Left unset, the session speaks in whichever voice the child's teacher has —
   * choosing Ms Vega gets Ms Vega's voice without anything here wiring the two
   * together. Set only when a child picks a different one mid-session.
   */
  voice?: "Aoede" | "Puck" | "Kore" | "Fenrir" | "Charon" | "Zephyr";
  topic?: string;
  level?: number;
  context?: string;
  /** The question on screen, when there is one. */
  question?: string;
}

export interface LiveVoiceCallbacks {
  onStatusChange: (status: "disconnected" | "connecting" | "connected" | "speaking" | "listening" | "error") => void;
  onModelText?: (text: string) => void;
  onUserText?: (text: string) => void;
  onAudioEnergy?: (userEnergy: number, modelEnergy: number) => void;
  onError?: (errorMessage: string) => void;
  onInterrupted?: () => void;
}

// Convert Float32Array PCM samples to 16-bit Signed Little-Endian Integer Base64
export function pcm16ToBase64(float32Array: Float32Array): string {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    // Clamp sample between -1.0 and 1.0
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Convert to binary string
  const uint8 = new Uint8Array(int16Array.buffer);
  let binary = "";
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

// Decode Base64 16-bit PCM Little Endian (24kHz) to AudioBuffer
export function base64ToAudioBuffer(
  audioCtx: AudioContext,
  base64: string,
  sampleRate: number = 24000
): AudioBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }

  const buffer = audioCtx.createBuffer(1, float32.length, sampleRate);
  buffer.getChannelData(0).set(float32);
  return buffer;
}

/**
 * The origin to open the live-voice socket against.
 *
 * Same origin as the page, unless the server names another one. It has to,
 * behind Firebase Hosting: Hosting proxies every path to Cloud Run but does not
 * perform the WebSocket upgrade, so the handshake comes back 200 rather than
 * 101 and the socket never opens. Pointing the socket straight at Cloud Run
 * fixes that without moving the page off Hosting's CDN.
 *
 * Asked once per load and cached — including the failure, because a deployment
 * that cannot answer is a deployment with no override, which is the same as
 * same-origin. Never throws: a coach that cannot reach its config should still
 * try the obvious address rather than refuse to start.
 */
let cachedWsOrigin: string | null = null;

export async function liveSocketOrigin(): Promise<string> {
  if (cachedWsOrigin !== null) return cachedWsOrigin;
  try {
    const res = await fetch("/api/config");
    const body = (await res.json()) as { liveWsOrigin?: unknown };
    const value = typeof body?.liveWsOrigin === "string" ? body.liveWsOrigin.trim() : "";
    // http(s) is what an operator will paste; the socket needs ws(s).
    cachedWsOrigin = value.replace(/^http/, "ws");
  } catch {
    cachedWsOrigin = "";
  }
  return cachedWsOrigin;
}

/**
 * Whether a frame of microphone audio is worth sending.
 *
 * Always, unless Koda is talking. While Koda talks the microphone is still
 * open — that is deliberate, a child must be able to cut in — but every frame
 * of it was being uploaded, silence and room noise included, and the model's
 * voice-activity detector treats "audio arriving" as "someone is speaking" and
 * stops Koda mid-sentence. On a laptop it stops him mid-sentence with his own
 * voice coming back through the speakers, which echo cancellation reduces but
 * does not remove.
 *
 * So while Koda is speaking a frame has to clear a floor: somebody actually
 * talking near the microphone, not a room. Once it clears, a hold keeps the
 * gate open through the gaps between words, or an interruption arrives as a
 * stutter of half-frames and the model hears a stammer rather than a sentence.
 *
 * When Koda is silent the gate is wide open, so a child's first word is never
 * the one that gets clipped.
 */
export const BARGE_IN_FLOOR = 0.04;
export const BARGE_IN_HOLD_MS = 700;

export function shouldSendMicFrame(input: {
  rms: number;
  kodaSpeaking: boolean;
  /** When the current burst of speech stops counting, from a previous frame. */
  holdUntil: number;
  now: number;
}): { send: boolean; holdUntil: number } {
  const { rms, kodaSpeaking, holdUntil, now } = input;

  if (!kodaSpeaking) return { send: true, holdUntil: 0 };
  if (rms >= BARGE_IN_FLOOR) return { send: true, holdUntil: now + BARGE_IN_HOLD_MS };
  // Mid-sentence gap in a burst that already cleared the floor.
  if (now < holdUntil) return { send: true, holdUntil };
  return { send: false, holdUntil: 0 };
}

export class GeminiLiveVoiceSession {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  private isConnected: boolean = false;
  private isMuted: boolean = false;
  private nextPlayTime: number = 0;
  private activeAudioSources: AudioBufferSourceNode[] = [];
  /** While Koda talks, how long the child's current burst keeps the gate open. */
  private bargeInHoldUntil: number = 0;
  private callbacks: LiveVoiceCallbacks;
  private config: LiveVoiceConfig;

  private userEnergyMeter: number = 0;
  private modelEnergyMeter: number = 0;
  private energyInterval: any = null;

  constructor(config: LiveVoiceConfig, callbacks: LiveVoiceCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  public async start(): Promise<void> {
    try {
      this.callbacks.onStatusChange("connecting");

      // 1. Request microphone stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      // 2. Initialize Audio Contexts
      // Input Audio Context (16kHz for Gemini input)
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });
      // Output Audio Context (24kHz for Gemini Live output)
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });

      // Resume in case browser suspended audio
      if (this.inputAudioCtx.state === "suspended") {
        await this.inputAudioCtx.resume();
      }
      if (this.outputAudioCtx.state === "suspended") {
        await this.outputAudioCtx.resume();
      }

      // 3. Connect WebSocket to backend proxy
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      // Where the socket may actually be opened. Same origin unless the
      // deployment says otherwise — see `liveSocketOrigin`.
      const origin = await liveSocketOrigin();
      // No voice default here any more: an empty `voice` lets the server use
      // the character's, which is the only place that knows which one it is.
      const voice = encodeURIComponent(this.config.voice || "");
      const topic = encodeURIComponent(this.config.topic || "Counting and Mathematics");
      const level = encodeURIComponent(this.config.level?.toString() || "1");
      const context = encodeURIComponent(this.config.context || "");
      const question = encodeURIComponent(this.config.question || "");
      const persona = encodeURIComponent(currentPersonaId());

      /*
       * The token is NOT in this URL, deliberately.
       *
       * It used to be, because a WebSocket handshake cannot carry an
       * Authorization header — and every proxy, CDN and load balancer on the
       * path writes URLs to a log. Full admin and child JWTs ended up sitting
       * in plaintext in Cloud Run's request log. It goes in the socket's first
       * frame instead, inside TLS, where nothing on the path records it.
       */
      const token = await tutorSocketToken();
      const base = origin || `${protocol}//${host}`;
      const wsUrl = `${base}/api/live?voice=${voice}&topic=${topic}&level=${level}&context=${context}&question=${question}&persona=${persona}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.callbacks.onStatusChange("connected");
        // Who this is, before anything else. The server reads nothing until it
        // has this, and disconnects a socket that never sends it.
        this.ws?.send(JSON.stringify({ type: "auth", token }));
        // The microphone waits for `ready`: until the server has a Gemini
        // session there is nothing to send audio to, and frames sent before it
        // are simply dropped.
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.error("Failed to parse Live WS message:", e);
        }
      };

      this.ws.onerror = (e) => {
        console.error("Live WebSocket Error:", e);
        this.callbacks.onError?.("WebSocket connection error");
        this.callbacks.onStatusChange("error");
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.callbacks.onStatusChange("disconnected");
        this.stopAllAudio();
      };
    } catch (err: any) {
      console.error("Failed to start Live Voice session:", err);
      this.callbacks.onError?.(err?.message || "Failed to access microphone or connect.");
      this.callbacks.onStatusChange("error");
      this.stop();
    }
  }

  private startMicProcessing(): void {
    if (!this.inputAudioCtx || !this.mediaStream) return;

    this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
    // Buffer size 2048 or 4096 (128ms / 256ms chunk)
    this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      if (!this.isConnected || this.isMuted) return;

      const inputBuffer = e.inputBuffer.getChannelData(0);

      // Compute input volume/energy for visualizer
      let sumSquares = 0;
      for (let i = 0; i < inputBuffer.length; i++) {
        sumSquares += inputBuffer[i] * inputBuffer[i];
      }
      const rms = Math.sqrt(sumSquares / inputBuffer.length);
      this.userEnergyMeter = Math.min(1.0, rms * 5.0);

      // While Koda is talking, only forward audio that is actually somebody
      // talking. See `shouldSendMicFrame` for why this is not just a filter.
      const gate = shouldSendMicFrame({
        rms,
        kodaSpeaking: this.activeAudioSources.length > 0,
        holdUntil: this.bargeInHoldUntil,
        now: Date.now(),
      });
      this.bargeInHoldUntil = gate.holdUntil;
      if (!gate.send) return;

      const base64Pcm = pcm16ToBase64(inputBuffer);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: "audio",
            audio: base64Pcm,
          })
        );
      }
    };

    this.sourceNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioCtx.destination);
  }

  private handleServerMessage(msg: any): void {
    if (msg.type === "ready") {
      // Authenticated, gated, and connected to Gemini. Only now is there
      // anywhere for the microphone's audio to go.
      this.startMicProcessing();
      this.startEnergyMonitoring();
      this.callbacks.onStatusChange("listening");
      window.setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const contextText = this.config.context || this.config.topic || "this math problem";
          this.sendTextMessage(
            `Hi Koda! I am struggling with this active question right now: "${contextText}". Can you greet me warmly and give me a gentle Socratic hint to help me solve it?`,
          );
        }
      }, 350);
    } else if (msg.type === "audio" && msg.audio) {
      this.playAudioChunk(msg.audio);
    } else if (msg.type === "modelText" && msg.text) {
      this.callbacks.onModelText?.(msg.text);
    } else if (msg.type === "userText" && msg.text) {
      this.callbacks.onUserText?.(msg.text);
    } else if (msg.type === "interrupted") {
      this.stopModelAudioQueue();
      this.callbacks.onInterrupted?.();
      this.callbacks.onStatusChange("listening");
    } else if (msg.type === "turnComplete") {
      // Model finished speaking turn
      setTimeout(() => {
        if (this.activeAudioSources.length === 0) {
          this.callbacks.onStatusChange("listening");
        }
      }, 500);
    } else if (msg.type === "error") {
      this.callbacks.onError?.(msg.error);
      this.callbacks.onStatusChange("error");
    }
  }

  private playAudioChunk(base64: string): void {
    if (!this.outputAudioCtx) return;

    try {
      this.callbacks.onStatusChange("speaking");
      this.modelEnergyMeter = 0.8;

      const audioBuffer = base64ToAudioBuffer(this.outputAudioCtx, base64, 24000);
      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioCtx.destination);

      const currentTime = this.outputAudioCtx.currentTime;
      // Schedule audio precisely for gapless continuous playback
      const startTime = Math.max(currentTime, this.nextPlayTime);
      source.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.activeAudioSources.push(source);

      source.onended = () => {
        const idx = this.activeAudioSources.indexOf(source);
        if (idx > -1) {
          this.activeAudioSources.splice(idx, 1);
        }
        if (this.activeAudioSources.length === 0) {
          this.modelEnergyMeter = 0;
          this.callbacks.onStatusChange("listening");
        }
      };
    } catch (e) {
      console.error("Error playing audio chunk:", e);
    }
  }

  private stopModelAudioQueue(): void {
    for (const src of this.activeAudioSources) {
      try {
        src.stop();
      } catch (e) {
        // ignore
      }
    }
    this.activeAudioSources = [];
    if (this.outputAudioCtx) {
      this.nextPlayTime = this.outputAudioCtx.currentTime;
    }
    this.modelEnergyMeter = 0;
  }

  private startEnergyMonitoring(): void {
    this.energyInterval = setInterval(() => {
      // Decay energy smoothly
      this.userEnergyMeter = Math.max(0, this.userEnergyMeter * 0.85);
      this.modelEnergyMeter = Math.max(0, this.modelEnergyMeter * 0.85);

      this.callbacks.onAudioEnergy?.(this.userEnergyMeter, this.modelEnergyMeter);
    }, 50);
  }

  public sendTextMessage(text: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "text", text }));
    }
  }

  public updateContext(context: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "updateContext", context }));
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public stopAllAudio(): void {
    this.stopModelAudioQueue();
  }

  public stop(): void {
    this.isConnected = false;
    if (this.energyInterval) {
      clearInterval(this.energyInterval);
      this.energyInterval = null;
    }

    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch (e) {}
      this.scriptProcessor = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.stopModelAudioQueue();

    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch (e) {}
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch (e) {}
      this.outputAudioCtx = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    this.callbacks.onStatusChange("disconnected");
  }
}
