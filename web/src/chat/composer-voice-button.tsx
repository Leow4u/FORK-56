import { Button } from "@work4you/ui/ui/components/button";
import { Loader2, Mic, Square } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface ComposerVoiceButtonProps {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  className?: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read audio"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Push-to-talk STT via ``POST /api/audio/transcribe`` (same backend as desktop).
 */
export function ComposerVoiceButton({
  disabled = false,
  onTranscript,
  onError,
  className,
}: ComposerVoiceButtonProps) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopAndTranscribe = useCallback(async () => {
    const recorder = mediaRef.current;
    if (!recorder) return;
    setRecording(false);
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });
    mediaRef.current = null;
    const blob = new Blob(chunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    });
    chunksRef.current = [];
    if (blob.size < 32) return;
    setBusy(true);
    try {
      const dataUrl = await blobToDataUrl(blob);
      const result = await api.transcribeAudio(dataUrl, blob.type);
      const text = (result.transcript || result.text || "").trim();
      if (result.error && !text) {
        onError?.(result.error);
      } else if (!text) {
        onError?.("No speech detected");
      } else {
        onTranscript(text);
      }
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : "Transcription failed",
      );
    } finally {
      setBusy(false);
    }
  }, [onError, onTranscript]);

  const start = useCallback(async () => {
    if (disabled || busy || recording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.("Microphone is not available in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onerror = () => {
        onError?.("Recording failed");
        setRecording(false);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : "Microphone permission denied",
      );
    }
  }, [busy, disabled, onError, recording]);

  const toggle = useCallback(() => {
    if (recording) {
      void stopAndTranscribe().then(() => {
        mediaRef.current?.stream
          ?.getTracks()
          .forEach((t) => t.stop());
      });
      return;
    }
    void start();
  }, [recording, start, stopAndTranscribe]);

  return (
    <Button
      type="button"
      size="icon"
      ghost
      disabled={disabled || busy}
      className={cn(
        "h-7 w-7 shrink-0",
        recording && "text-destructive",
        className,
      )}
      aria-label={recording ? "Stop recording" : "Dictate with microphone"}
      title={recording ? "Stop recording" : "Dictate"}
      onClick={toggle}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : recording ? (
        <Square className="h-3.5 w-3.5" />
      ) : (
        <Mic className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
