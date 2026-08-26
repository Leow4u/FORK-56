import { Button } from "@work4you/ui/ui/components/button";
import { FileDiff, Files, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { RightFilesPane } from "./right-files";
import { RightReviewPane } from "./right-review";

export type RightContextTab = "files" | "review";

export interface RightContextPaneProps {
  workspaceCwd: string | null;
  onOpenWorkspace?: () => void;
  onClose?: () => void;
  onAddPathToChat?: (path: string) => void;
  initialTab?: RightContextTab;
  className?: string;
}

/**
 * Right-context shell: Files (cwd tree) + Review (uncommitted git).
 */
export function RightContextPane({
  workspaceCwd,
  onOpenWorkspace,
  onClose,
  onAddPathToChat,
  initialTab = "files",
  className,
}: RightContextPaneProps) {
  const [tab, setTab] = useState<RightContextTab>(initialTab);

  return (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col border-l border-border/40 bg-background",
        className,
      )}
    >
      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border/40 px-1.5">
        <Button
          type="button"
          size="sm"
          ghost={tab !== "files"}
          className="h-6 gap-1 px-2 text-[0.7rem]"
          aria-pressed={tab === "files"}
          onClick={() => setTab("files")}
        >
          <Files className="h-3.5 w-3.5" />
          Files
        </Button>
        <Button
          type="button"
          size="sm"
          ghost={tab !== "review"}
          className="h-6 gap-1 px-2 text-[0.7rem]"
          aria-pressed={tab === "review"}
          onClick={() => setTab("review")}
        >
          <FileDiff className="h-3.5 w-3.5" />
          Review
        </Button>
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
        {tab === "files" ? (
          <RightFilesPane
            workspaceCwd={workspaceCwd}
            onOpenWorkspace={onOpenWorkspace}
            onAddPathToChat={onAddPathToChat}
            embedded
            className="border-l-0"
          />
        ) : (
          <RightReviewPane
            workspaceCwd={workspaceCwd}
            onOpenWorkspace={onOpenWorkspace}
            embedded
            className="border-l-0"
          />
        )}
      </div>
    </div>
  );
}
