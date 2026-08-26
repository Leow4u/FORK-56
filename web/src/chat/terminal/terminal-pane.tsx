import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { Terminal as XtermTerminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@work4you/ui/ui/components/button";
import { FolderOpen, Terminal as TerminalIcon, X } from "lucide-react";
import { useEffect, useRef, useState, type MutableRefObject } from "react";

import { buildWsUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

import { hasOpenWorkspace } from "../workspace";
import {
  agentTabId,
  closeAgentTerminal,
  selectTerminalTab,
  type AgentTerminalState,
  type TerminalActiveId,
} from "./agent-terminals";

export interface RightTerminalPaneProps {
  workspaceCwd: string | null;
  onOpenWorkspace?: () => void;
  className?: string;
  /** Register a buffer reader for terminal.read.request. */
  bufferRef?: MutableRefObject<(() => string) | null>;
  agentTerminals: AgentTerminalState;
  onAgentTerminalsChange: (next: AgentTerminalState) => void;
}

/**
 * Interactive shell via ``/api/shell-pty`` (agent-host cwd) plus read-only
 * agent background-process tabs (``agent.terminal.output``).
 * Distinct from the old ``/api/pty`` TUI embed.
 */
export function RightTerminalPane({
  workspaceCwd,
  onOpenWorkspace,
  className,
  bufferRef,
  agentTerminals,
  onAgentTerminalsChange,
}: RightTerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XtermTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const bufferLinesRef = useRef<string[]>([]);
  const agentTerminalsRef = useRef(agentTerminals);
  agentTerminalsRef.current = agentTerminals;

  const open = hasOpenWorkspace(workspaceCwd);
  const cwd = open ? workspaceCwd!.trim() : "";
  const activeId = agentTerminals.activeId;
  const showShell = activeId === "shell";

  useEffect(() => {
    if (!bufferRef) return;
    bufferRef.current = () => {
      const st = agentTerminalsRef.current;
      if (st.activeId !== "shell") {
        const pid = st.activeId.slice("agent:".length);
        return st.tabs.find((t) => t.processId === pid)?.buffer ?? "";
      }
      return bufferLinesRef.current.slice(-500).join("\n");
    };
    return () => {
      bufferRef.current = null;
    };
  }, [bufferRef]);

  useEffect(() => {
    if (!open || !cwd || !hostRef.current || !showShell) {
      setConnected(false);
      return;
    }

    let cancelled = false;
    const term = new XtermTerminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 12,
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      theme: {
        background: "#0d0d0d",
        foreground: "#e8e8e8",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new Unicode11Addon());
    term.unicode.activeVersion = "11";
    term.open(hostRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;
    bufferLinesRef.current = [];

    const onData = term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          const cols = term.cols;
          const rows = term.rows;
          ws.send(
            new TextEncoder().encode(`\x1b[RESIZE:${cols};${rows}]`),
          );
        }
      } catch {
        // ignore
      }
    });
    resizeObserver.observe(hostRef.current);

    void (async () => {
      try {
        const cols = term.cols || 80;
        const rows = term.rows || 24;
        const url = await buildWsUrl("/api/shell-pty", {
          cwd,
          cols: String(cols),
          rows: String(rows),
        });
        if (cancelled) return;
        const ws = new WebSocket(url);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;
        ws.onopen = () => {
          if (!cancelled) setConnected(true);
          setError(null);
        };
        ws.onmessage = (ev) => {
          const data =
            typeof ev.data === "string"
              ? ev.data
              : new TextDecoder().decode(ev.data as ArrayBuffer);
          term.write(data);
          const lines = data.replace(/\r/g, "").split("\n");
          bufferLinesRef.current.push(...lines);
          if (bufferLinesRef.current.length > 2000) {
            bufferLinesRef.current = bufferLinesRef.current.slice(-1500);
          }
        };
        ws.onerror = () => {
          if (!cancelled) setError("Shell connection error");
        };
        ws.onclose = () => {
          if (!cancelled) {
            setConnected(false);
            term.writeln("\r\n\x1b[33m[shell disconnected]\x1b[0m");
          }
        };
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open shell");
        }
      }
    })();

    return () => {
      cancelled = true;
      onData.dispose();
      resizeObserver.disconnect();
      wsRef.current?.close();
      wsRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [cwd, open, showShell]);

  const setActive = (id: TerminalActiveId) => {
    onAgentTerminalsChange(selectTerminalTab(agentTerminals, id));
  };

  const activeAgent =
    activeId !== "shell"
      ? agentTerminals.tabs.find(
          (t) => t.processId === activeId.slice("agent:".length),
        )
      : null;

  if (!open && agentTerminals.tabs.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-2 px-4 text-center",
          className,
        )}
      >
        <TerminalIcon className="h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">No project open</p>
        <p className="text-xs text-muted-foreground">
          Open a project so the shell starts in that working directory.
        </p>
        {onOpenWorkspace && (
          <Button
            type="button"
            size="sm"
            className="mt-1"
            onClick={onOpenWorkspace}
          >
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            Open project
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative flex h-full min-h-0 flex-col", className)}>
      <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border/30 px-1 py-1">
        <button
          type="button"
          className={cn(
            "rounded px-1.5 py-0.5 text-[0.65rem]",
            showShell
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/50",
          )}
          onClick={() => setActive("shell")}
          disabled={!open}
        >
          Shell
        </button>
        {agentTerminals.tabs.map((tab) => {
          const id = agentTabId(tab.processId);
          const selected = activeId === id;
          return (
            <button
              key={tab.processId}
              type="button"
              className={cn(
                "flex max-w-[8rem] items-center gap-1 rounded px-1.5 py-0.5 text-[0.65rem]",
                selected
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
              onClick={() => setActive(id)}
            >
              <span className="truncate">{tab.title}</span>
              <span
                role="button"
                tabIndex={0}
                className="rounded p-0.5 hover:bg-background"
                aria-label="Close agent terminal"
                onClick={(e) => {
                  e.stopPropagation();
                  onAgentTerminalsChange(
                    closeAgentTerminal(agentTerminals, tab.processId),
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onAgentTerminalsChange(
                      closeAgentTerminal(agentTerminals, tab.processId),
                    );
                  }
                }}
              >
                <X className="h-2.5 w-2.5" />
              </span>
            </button>
          );
        })}
      </div>

      {showShell ? (
        <>
          <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border/30 px-2 text-[0.65rem] text-muted-foreground">
            <TerminalIcon className="h-3.5 w-3.5" />
            <span className="truncate">{cwd || "No project"}</span>
            <span
              className={cn(
                "ml-auto",
                connected ? "text-emerald-500" : "text-amber-500",
              )}
            >
              {open ? (connected ? "connected" : "…") : "—"}
            </span>
          </div>
          {error && (
            <div className="border-b border-destructive/30 bg-destructive/10 px-2 py-1 text-[0.65rem] text-destructive">
              {error}
            </div>
          )}
          {!open ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
              <p className="text-xs text-muted-foreground">
                Open a project to start an interactive shell.
              </p>
              {onOpenWorkspace && (
                <Button type="button" size="sm" onClick={onOpenWorkspace}>
                  Open project
                </Button>
              )}
            </div>
          ) : (
            <div ref={hostRef} className="min-h-0 flex-1 p-1" />
          )}
        </>
      ) : (
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-[#0d0d0d] p-2 font-mono text-[0.65rem] leading-relaxed text-[#e8e8e8]">
          {activeAgent?.buffer || "(no output yet)"}
        </pre>
      )}
    </div>
  );
}
