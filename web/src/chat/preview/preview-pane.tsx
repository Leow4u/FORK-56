import { ExternalLink, FileIcon, Globe, X } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import type { PreviewState, PreviewTarget } from "./preview-state";
import { closePreviewAt } from "./preview-state";

export interface RightPreviewPaneProps {
  state: PreviewState;
  onChange: (next: PreviewState) => void;
  className?: string;
}

function FilePreviewBody({ target }: { target: PreviewTarget }) {
  const [text, setText] = useState(target.text ?? "");
  const [dataUrl, setDataUrl] = useState(target.dataUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!target.text && !target.dataUrl);

  useEffect(() => {
    if (target.text || target.dataUrl || !target.path) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const path = target.path;
    void (async () => {
      try {
        const lower = path.toLowerCase();
        if (/\.(png|jpe?g|gif|webp|svg|pdf)$/i.test(lower)) {
          const result = await api.readFsDataUrl(path);
          if (!cancelled) setDataUrl(result.dataUrl);
        } else {
          const result = await api.readFsText(path);
          if (!cancelled) {
            if (result.binary) {
              setError("Binary file — open via Files peek or download.");
            } else {
              setText(result.text);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Preview failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target.dataUrl, target.path, target.text]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Loading preview…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-3 text-center text-xs text-destructive">
        {error}
      </div>
    );
  }
  if (dataUrl) {
    if (dataUrl.startsWith("data:application/pdf")) {
      return (
        <iframe title={target.label} src={dataUrl} className="h-full w-full border-0" />
      );
    }
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-2">
        <img src={dataUrl} alt={target.label} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  return (
    <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-2 font-mono text-[0.65rem] leading-relaxed text-foreground/90">
      {text || "(empty)"}
    </pre>
  );
}

function UrlPreviewBody({ target }: { target: PreviewTarget }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border/30 px-2 py-1">
        <Globe className="h-3 w-3 opacity-70" />
        <span className="min-w-0 flex-1 truncate text-[0.65rem]">{target.url}</span>
        <a
          href={target.url}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Open in browser"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <iframe
        title={target.label}
        src={target.url}
        className="min-h-0 flex-1 w-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}

/**
 * Preview rail — file text/image + URL iframe (desktop Preview subset).
 */
export function RightPreviewPane({
  state,
  onChange,
  className,
}: RightPreviewPaneProps) {
  const active =
    state.activeIndex >= 0 ? state.tabs[state.activeIndex] : null;

  if (state.tabs.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-2 px-4 text-center",
          className,
        )}
      >
        <FileIcon className="h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">No preview open</p>
        <p className="text-xs text-muted-foreground">
          Open a file from Files, or the agent can call open_preview.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border/30 px-1 py-1">
        {state.tabs.map((tab, i) => (
          <button
            key={`${tab.kind}:${tab.path || tab.url}:${i}`}
            type="button"
            className={cn(
              "flex max-w-[8rem] items-center gap-1 rounded px-1.5 py-0.5 text-[0.65rem]",
              i === state.activeIndex
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50",
            )}
            onClick={() => onChange({ ...state, activeIndex: i })}
          >
            <span className="truncate">{tab.label}</span>
            <span
              role="button"
              tabIndex={0}
              className="rounded p-0.5 hover:bg-background"
              aria-label="Close tab"
              onClick={(e) => {
                e.stopPropagation();
                onChange(closePreviewAt(state, i));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange(closePreviewAt(state, i));
                }
              }}
            >
              <X className="h-2.5 w-2.5" />
            </span>
          </button>
        ))}
      </div>
      {active?.kind === "url" ? (
        <UrlPreviewBody target={active} />
      ) : active ? (
        <FilePreviewBody target={active} />
      ) : null}
    </div>
  );
}

export function activePreviewSnapshot(
  state: PreviewState,
): Record<string, unknown> | null {
  const tab = state.activeIndex >= 0 ? state.tabs[state.activeIndex] : null;
  if (!tab) return null;
  return {
    kind: tab.kind,
    label: tab.label,
    url: tab.url,
    path: tab.path,
    mimeType: tab.mimeType,
  };
}
