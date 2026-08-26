import { Button } from "@work4you/ui/ui/components/button";
import { Eye, FileDiff, Files, Terminal, X } from "lucide-react";
import { useEffect, useState, type MutableRefObject } from "react";

import { cn } from "@/lib/utils";

import { RightPreviewPane } from "./preview/preview-pane";
import type { PreviewState } from "./preview/preview-state";
import { RightFilesPane } from "./right-files";
import { RightReviewPane } from "./right-review";
import type { AgentTerminalState } from "./terminal/agent-terminals";
import { RightTerminalPane } from "./terminal/terminal-pane";

export type RightContextTab = "files" | "review" | "preview" | "terminal";

export interface RightContextPaneProps {
  workspaceCwd: string | null;
  onOpenWorkspace?: () => void;
  onClose?: () => void;
  onAddPathToChat?: (path: string) => void;
  /** Open a project file in the Preview tab (Files peek → Preview). */
  onOpenFilePreview?: (path: string) => void;
  initialTab?: RightContextTab;
  /** Controlled tab (pane.reveal / preview.open). */
  tab?: RightContextTab;
  onTabChange?: (tab: RightContextTab) => void;
  previewState: PreviewState;
  onPreviewChange: (next: PreviewState) => void;
  terminalBufferRef?: MutableRefObject<(() => string) | null>;
  agentTerminals: AgentTerminalState;
  onAgentTerminalsChange: (next: AgentTerminalState) => void;
  className?: string;
}

/**
 * Right-context shell: Files · Review · Preview · Terminal.
 */
export function RightContextPane({
  workspaceCwd,
  onOpenWorkspace,
  onClose,
  onAddPathToChat,
  onOpenFilePreview,
  initialTab = "files",
  tab: tabProp,
  onTabChange,
  previewState,
  onPreviewChange,
  terminalBufferRef,
  agentTerminals,
  onAgentTerminalsChange,
  className,
}: RightContextPaneProps) {
  const [tabLocal, setTabLocal] = useState<RightContextTab>(initialTab);
  const tab = tabProp ?? tabLocal;

  useEffect(() => {
    if (tabProp !== undefined) setTabLocal(tabProp);
  }, [tabProp]);

  const setTab = (next: RightContextTab) => {
    setTabLocal(next);
    onTabChange?.(next);
  };

  const tabs: { id: RightContextTab; label: string; icon: typeof Files }[] = [
    { id: "files", label: "Files", icon: Files },
    { id: "review", label: "Review", icon: FileDiff },
    { id: "preview", label: "Preview", icon: Eye },
    { id: "terminal", label: "Terminal", icon: Terminal },
  ];

  return (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col border-l border-border/40 bg-background",
        className,
      )}
    >
      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border/40 px-1.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            size="sm"
            ghost={tab !== id}
            className="h-6 gap-1 px-2 text-[0.7rem]"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
        <div className="flex-1" />
        {onClose && (
          <Button
            type="button"
            size="icon"
            ghost
            className="h-6 w-6"
            aria-label="Hide panel"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {tab === "files" && (
          <RightFilesPane
            workspaceCwd={workspaceCwd}
            onOpenWorkspace={onOpenWorkspace}
            onAddPathToChat={onAddPathToChat}
            onOpenFilePreview={onOpenFilePreview}
            embedded
            className="border-l-0"
          />
        )}
        {tab === "review" && (
          <RightReviewPane
            workspaceCwd={workspaceCwd}
            onOpenWorkspace={onOpenWorkspace}
            embedded
            className="border-l-0"
          />
        )}
        {tab === "preview" && (
          <RightPreviewPane
            state={previewState}
            onChange={onPreviewChange}
          />
        )}
        {tab === "terminal" && (
          <RightTerminalPane
            workspaceCwd={workspaceCwd}
            onOpenWorkspace={onOpenWorkspace}
            bufferRef={terminalBufferRef}
            agentTerminals={agentTerminals}
            onAgentTerminalsChange={onAgentTerminalsChange}
          />
        )}
      </div>
    </div>
  );
}
