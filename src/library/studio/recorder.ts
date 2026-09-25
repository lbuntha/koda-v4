import { useState } from "react";

/**
 * The microphone, one recording at a time. `key` names what is being recorded
 * (a sentence id, a Khmer unit) so a screen can show which button is live.
 */
export function useRecorder() {
  const [rec, setRec] = useState<{ key: string; mr: MediaRecorder } | null>(null);
  const start = async (key: string, onDone: (blob: Blob) => void) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    const parts: BlobPart[] = [];
    mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setRec(null);
      onDone(new Blob(parts, { type: (mr.mimeType || "audio/webm").split(";")[0] }));
    };
    mr.start();
    setRec({ key, mr });
  };
  return { recording: rec?.key ?? null, start, stop: () => rec?.mr.stop() };
}
