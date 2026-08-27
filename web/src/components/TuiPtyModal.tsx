// @ts-nocheck — desktop parity port; web shims pending.
/**
 * Embedded ``work4you --tui`` in xterm.js over ``/api/pty``.
 *
 * Same bridge the dashboard used before thin chat (see git 4942ae0
 * ``web/src/pages/ChatPage.tsx``). Distinct from desktop
 * ``openSessionInTerminal`` (native OS terminal) — this is a **browser PTY**:
 * real Ink TUI + tui_gateway, not a transcript rewrite.
 */

import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@work4you/ui/ui/components/button";
import { Spinner } from "@work4you/ui/ui/components/spinner";
import { Terminal as TerminalIcon, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useModalBehavior } from "@/hooks/useModalBehavior";
import { buildWsUrl } from "@/lib/api";
import { maybeReloadForLoopbackWsAuthFailure } from "@/lib/dashboard-auth-reload";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes";

export interface TuiPtyModalProps {
  open: boolean;
  onClose: () => void;
  /** Stored session id to resume in the TUI (`?resume=`). */
  resumeSessionId: string;
  profile?: string;
}

function buildTerminalTheme(background: string, foreground: string) {
  return {
    background,
    foreground,
    cursor: foreground,
    cursorAccent: background,
    selectionBackground:
      foreground.length === 7 ? `${foreground}44` : foreground,
  };
}

function generateChannelId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `tui-modal-${crypto.randomUUID()}`;
  }
  return `tui-modal-${Math.random().toString(36).slice(2)}`;
}

export function TuiPtyModal({
  open,
  onClose,
  resumeSessionId,
  profile,
}: TuiPtyModalProps) {
  const modalRef = useModalBehavior({ open, onClose });
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsOpenedRef = useRef(false);
  const [state, setState] = useState<"idle" | "connecting" | "open" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  const teardown = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    termRef.current?.dispose();
    termRef.current = null;
    fitRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      teardown();
      setState("idle");
      setError(null);
      return;
    }

    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    wsOpenedRef.current = false;
    setState("connecting");
    setError(null);

    const bg = theme.terminalBackground ?? "#000000";
    const fg = theme.terminalForeground ?? "#f0e6d2";
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 12,
      theme: buildTerminalTheme(bg, fg),
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    const unicode = new Unicode11Addon();
    term.loadAddon(fit);
    term.loadAddon(unicode);
    term.loadAddon(new WebLinksAddon());
    term.open(host);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const channel = generateChannelId();
    const params: Record<string, string> = {
      channel,
      resume: resumeSessionId,
    };
    if (profile) params.profile = profile;

    void (async () => {
      try {
        const url = await buildWsUrl("/api/pty", params);
        if (cancelled) return;
        const ws = new WebSocket(url);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) return;
          wsOpenedRef.current = true;
          setState("open");
          fit.fit();
        };

        ws.onmessage = (ev) => {
          if (cancelled || !termRef.current) return;
          if (typeof ev.data === "string") {
            termRef.current.write(ev.data);
          } else if (ev.data instanceof ArrayBuffer) {
            termRef.current.write(new Uint8Array(ev.data));
          }
        };

        ws.onerror = () => {
          if (cancelled) return;
          setState("error");
          setError("WebSocket error");
        };

        ws.onclose = (ev) => {
          if (cancelled) return;
          void maybeReloadForLoopbackWsAuthFailure(ev.code, ev.reason);
          if (!wsOpenedRef.current) {
            setState("error");
            setError(ev.reason || `Connection closed (${ev.code})`);
          }
        };

        term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });

        term.onResize(({ cols, rows }) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(`\x1b[RESIZE:${cols};${rows}]`);
          }
        });
      } catch (e) {
        if (cancelled) return;
        setState("error");
        setError(e instanceof Error ? e.message : "Failed to connect");
      }
    })();

    const ro = new ResizeObserver(() => {
      fitRef.current?.fit();
    });
    ro.observe(host);

    return () => {
      cancelled = true;
      ro.disconnect();
      teardown();
    };
  }, [open, profile, resumeSessionId, teardown, theme.terminalBackground, theme.terminalForeground]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={cn(
          "flex h-[min(90vh,48rem)] w-full max-w-5xl flex-col overflow-hidden",
          "rounded-lg border border-border bg-background shadow-xl",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tui-pty-modal-title"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
          <TerminalIcon className="h-4 w-4 text-muted-foreground" />
          <span
            id="tui-pty-modal-title"
            className="min-w-0 flex-1 truncate text-sm font-medium"
          >
            TUI — {resumeSessionId.slice(0, 8)}…
          </span>
          {state === "connecting" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Spinner className="h-3.5 w-3.5" />
              Connecting…
            </span>
          )}
          {state === "open" && (
            <span className="text-xs text-emerald-600">live</span>
          )}
          <Button
            ghost
            size="icon"
            aria-label="Close"
            onClick={onClose}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div
          ref={hostRef}
          className="work4you-chat-xterm-host min-h-0 flex-1 overflow-hidden bg-black p-1 [&_.xterm]:h-full"
        />
      </div>
    </div>,
    document.body,
  );
}
