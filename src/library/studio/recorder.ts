import { useEffect, useRef, useState } from "react";

/**
 * The microphone, one recording at a time. `key` names what is being recorded
 * (a sentence id, a Khmer unit) so a screen can show which button is live.
 */
export function useRecorder() {
  const [rec, setRec] = useState<{ key: string; mr: MediaRecorder } | null>(null);
  const active = useRef<MediaRecorder | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const mr = active.current;
      active.current = null;
      if (mr && mr.state !== "inactive") mr.stop();
    };
  }, []);
  const start = async (key: string, onDone: (blob: Blob) => void) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const release = () => stream.getTracks().forEach((t) => t.stop());
    if (!mounted.current || active.current) {
      release();
      return;
    }
    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(stream);
    } catch (error) {
      release();
      throw error;
    }
    const parts: BlobPart[] = [];
    mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
    mr.onstop = () => {
      release();
      if (!mounted.current || active.current !== mr) return;
      active.current = null;
      setRec(null);
      onDone(new Blob(parts, { type: (mr.mimeType || "audio/webm").split(";")[0] }));
    };
    try {
      mr.start();
    } catch (error) {
      release();
      throw error;
    }
    active.current = mr;
    setRec({ key, mr });
  };
  return { recording: rec?.key ?? null, start, stop: () => {
    if (rec?.mr.state === "recording") rec.mr.stop();
  } };
}
