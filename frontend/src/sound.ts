/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simple browser synthesizer using Web Audio API
class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  private unlockBound = false;

  private initCtx() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    this.bindUnlock();
  }

  /**
   * Safari (and iOS in particular) will not start an AudioContext outside a
   * user gesture, and silently ignores `resume()` called from anywhere else.
   * Prime it on the very first tap or key press — playing a one-sample buffer
   * inside the gesture is what actually unlocks output on iOS; resuming alone
   * is not enough there.
   */
  private bindUnlock() {
    if (this.unlockBound || typeof window === "undefined") return;
    this.unlockBound = true;

    const unlock = () => {
      const ctx = this.ctx;
      if (!ctx) return;
      ctx.resume().catch(() => {});
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch {
        /* already unlocked, or unsupported */
      }
    };

    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
  }

  /**
   * Run `schedule` against a context that is genuinely running.
   *
   * A suspended context's `currentTime` is frozen at 0 and does not advance, so
   * scheduling straight after a fire-and-forget `resume()` pins the whole
   * envelope — start, ramp and stop — to a clock that has not begun. By the
   * time the context actually starts, `currentTime` has jumped far past the
   * note's stop time and it never sounds. Safari hits this constantly because
   * it suspends aggressively and resumes slowly; waiting for resume to resolve
   * before reading the clock is what makes envelopes audible there.
   */
  private schedule(run: (ctx: AudioContext, now: number) => void) {
    if (!this.enabled) return;
    this.initCtx();
    const ctx = this.ctx;
    if (!ctx) return;

    if (ctx.state === "running") {
      try {
        run(ctx, ctx.currentTime);
      } catch (e) {
        console.warn("Audio play failed:", e);
      }
      return;
    }

    ctx.resume()
      .then(() => {
        if (ctx.state !== "running") return;
        try {
          run(ctx, ctx.currentTime);
        } catch (e) {
          console.warn("Audio play failed:", e);
        }
      })
      .catch(() => {
        /* blocked until a user gesture — the unlock handler will prime it */
      });
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1) {
    this.schedule((ctx, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(volume, now);
      gain.gain.linearRampToValueAtTime(0, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);

      // Release the nodes once the tone has decayed so they do not pile up.
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };
    });
  }

  public playPop() {
    // A nice pop sound for tapping/selecting
    this.playTone(350, "sine", 0.1, 0.2);
  }

  public playTick(numberValue: number = 1) {
    // Rising pitch based on the current count (adds to mathematical sense of size!)
    const freq = 300 + numberValue * 40;
    this.playTone(freq, "triangle", 0.15, 0.25);
  }

  public playSlide() {
    this.playTone(200, "sine", 0.08, 0.15);
  }

  public playSuccess() {
    this.schedule((ctx, now) => {
      // Rising arpeggio chime (C4, E4, G4, C5)
      const notes = [261.63, 329.63, 392.0, 523.25];
      notes.forEach((freq, idx) => {
        const at = now + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, at);

        // Start silent so the note does not click in at the gain node's
        // default value of 1 before its own envelope begins.
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0.12, at);
        gain.gain.linearRampToValueAtTime(0, at + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(at);
        osc.stop(at + 0.35);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
        };
      });
    });
  }

  public playSparkle() {
    this.playTone(880, "sine", 0.2, 0.08);
  }

  public playFailure() {
    // Low double buzz
    this.schedule((ctx, now) => {
      [110, 100].forEach((freq, idx) => {
        const at = now + idx * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, at);

        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0.1, at);
        gain.gain.linearRampToValueAtTime(0, at + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(at);
        osc.stop(at + 0.28);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
        };
      });
    });
  }

  public playWin() {
    this.playSuccess();
  }

  public playTock() {
    this.playTone(180, "sine", 0.1, 0.15);
  }

  public playFail() {
    this.playFailure();
  }

  public playLevelUp() {
    this.playSuccess();
  }

  public playPour(transferCount: number = 1) {
    this.schedule((ctx, now) => {
      // Play a sequence of rising bubble pop sounds to simulate pouring liquid
      const count = 4 + transferCount * 2;
      for (let i = 0; i < count; i++) {
        const time = now + i * 0.07;
        const freq = 320 + i * 65; // rising pitch as liquid fills target
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time);

        // Quick attack and exponential decay for organic bubble sound
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.06, time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.08);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
        };
      }
    });
  }
}

export const sounds = new SoundSynthesizer();

