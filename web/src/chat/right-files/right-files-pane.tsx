import { Button } from "@work4you/ui/ui/components/button";
import {
  ChevronsDownUp,
  FileIcon,
  FolderOpen,
  RefreshCw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { hasOpenWorkspace, workspaceLabel } from "../workspace";
import { readProjectFileText } from "./fs-client";
import { ProjectTree } from "./project-tree";
import { useProjectTree } from "./use-project-tree";

export interface RightFilesPaneProps {
  workspaceCwd: string | null;
  onOpenWorkspace?: () => void;
  onClose?: () => void;
  /** Insert a path reference into the composer draft. */
  onAddPathToChat?: (path: string) => void;
  /** When true, skip the pane's own title row (parent provides tabs). */
  embedded?: boolean;
  className?: string;
}

interface FilePeek {
  path: string;
  text: string;
  binary: boolean;
  truncated: boolean;
  error?: string;
  loading: boolean;
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}

/**
 * Session-cwd file tree (desktop right Files). Not the managed ``/files`` admin page.
 */
export function RightFilesPane({
  workspaceCwd,
  onOpenWorkspace,
  onClose,
  onAddPathToChat,
  embedded = false,
  className,
}: RightFilesPaneProps) {
  const hasWorkspace = hasOpenWorkspace(workspaceCwd);
  const cwd = hasWorkspace ? workspaceCwd!.trim() : "";
  const {
    collapseNonce,
    data,
    effectiveCwd,
    loadChildren,
    openState,
    refreshRoot,
    rootError,
    rootLoading,
    setNodeOpen,
    collapseAll,
  } = useProjectTree(cwd);

  const [peek, setPeek] = useState<FilePeek | null>(null);
  const cwdName = workspaceLabel(effectiveCwd || cwd);
  const canCollapse = Object.values(openState).some(Boolean);

  useEffect(() => {
    setPeek(null);
  }, [cwd]);

  const previewFile = useCallback(async (path: string) => {
    setPeek({
      path,
      text: "",
      binary: false,
      truncated: false,
      loading: true,
    });
    try {
      const result = await readProjectFileText(path);
      setPeek({
        path: result.path || path,
        text: result.text ?? "",
        binary: Boolean(result.binary),
        truncated: Boolean(result.truncated),
        loading: false,
      });
    } catch (err) {
      setPeek({
        path,
        text: "",
        binary: false,
        truncated: false,
        loading: false,
        error: err instanceof Error ? err.message : "Preview unavailable",
      });
    }
  }, []);

  const activateFile = useCallback(
    (path: string) => {
      void previewFile(path);
    },
    [previewFile],
  );

  const activateFolder = useCallback((_path: string) => {
    // Folders expand via toggle; no path insert on navigate.
  }, []);

  return (
    <aside
      aria-label="File system"
      className={cn(
        "flex h-full w-full min-w-0 flex-col overflow-hidden",
        "border-l border-border/40 bg-background/80 text-muted-foreground",
        className,
      )}
    >
      {!hasWorkspace ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {!embedded && (
            <div className="flex h-8 shrink-0 items-center justify-between gap-1 border-b border-border/40 px-2.5">
              <span className="truncate text-xs font-medium text-foreground">
                Files
              </span>
              {onClose && (
                <Button
                  type="button"
                  size="icon"
                  ghost
                  className="h-6 w-6"
                  aria-label="Hide files"
                  onClick={onClose}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
          <EmptyState
            title="No project open"
            body="Open a project to browse its files."
            action={
              onOpenWorkspace ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-1"
                  onClick={onOpenWorkspace}
                >
                  <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                  Open project
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              "group/project-header flex h-8 shrink-0 items-center gap-0.5 px-2",
              !embedded && "border-b border-border/40",
              embedded && "border-b border-border/30",
            )}
          >
            <span
              className="min-w-0 flex-1 truncate px-0.5 text-xs font-medium text-foreground"
              title={effectiveCwd || cwd}
            >
              {cwdName}
            </span>
            <Button
              type="button"
              size="icon"
              ghost
              className="h-6 w-6"
              aria-label="Refresh tree"
              disabled={rootLoading}
              onClick={() => void refreshRoot()}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", rootLoading && "animate-spin")}
              />
            </Button>
            <Button
              type="button"
              size="icon"
              ghost
              className={cn("h-6 w-6", !canCollapse && "invisible")}
              aria-label="Collapse all folders"
              disabled={!canCollapse}
              onClick={collapseAll}
            >
              <ChevronsDownUp className="h-3.5 w-3.5" />
            </Button>
            {!embedded && onClose && (
              <Button
                type="button"
                size="icon"
                ghost
                className="h-6 w-6"
                aria-label="Hide files"
                onClick={onClose}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {rootError ? (
            <EmptyState
              title="Unreadable"
              body={`Could not read this folder (${rootError}).`}
              action={
                <button
                  type="button"
                  className="text-[0.68rem] font-medium text-muted-foreground transition hover:text-foreground"
                  onClick={() => void refreshRoot()}
                >
                  Try again
                </button>
              }
            />
          ) : rootLoading && data.length === 0 ? (
            <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-xs text-muted-foreground">
              Loading files…
            </div>
          ) : data.length === 0 ? (
            <EmptyState title="Empty" body="This folder is empty." />
          ) : (
            <ProjectTree
              collapseNonce={collapseNonce}
              cwd={effectiveCwd || cwd}
              data={data}
              openState={openState}
              onActivateFile={activateFile}
              onActivateFolder={activateFolder}
              onLoadChildren={loadChildren}
              onNodeOpenChange={setNodeOpen}
              onPreviewFile={(path) => void previewFile(path)}
            />
          )}

          {peek && (
            <div className="flex max-h-[40%] min-h-[6rem] shrink-0 flex-col border-t border-border/40">
              <div className="flex h-7 shrink-0 items-center gap-1 px-2">
                <FileIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span
                  className="min-w-0 flex-1 truncate text-[0.7rem] text-foreground"
                  title={peek.path}
                >
                  {peek.path.split(/[\\/]/).filter(Boolean).pop() || peek.path}
                </span>
                {onAddPathToChat && (
                  <Button
                    type="button"
                    size="sm"
                    ghost
                    className="h-6 px-1.5 text-[0.65rem]"
                    onClick={() => onAddPathToChat(peek.path)}
                  >
                    Add to chat
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  ghost
                  className="h-6 w-6"
                  aria-label="Close preview"
                  onClick={() => setPeek(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
                {peek.loading ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    Loading preview…
                  </p>
                ) : peek.error ? (
                  <p className="text-[0.7rem] text-destructive">{peek.error}</p>
                ) : peek.binary ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    Binary file — preview unavailable.
                  </p>
                ) : (
                  <pre className="whitespace-pre-wrap break-words font-mono text-[0.65rem] leading-relaxed text-foreground/90">
                    {peek.text || "(empty)"}
                    {peek.truncated ? "\n… truncated" : ""}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
