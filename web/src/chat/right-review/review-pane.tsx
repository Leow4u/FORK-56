import { Button } from "@work4you/ui/ui/components/button";
import {
  FileDiff,
  FolderOpen,
  GitBranch,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { hasOpenWorkspace, workspaceLabel } from "../workspace";
import { basename } from "./git-client";
import { useReview } from "./use-review";

export interface RightReviewPaneProps {
  workspaceCwd: string | null;
  onOpenWorkspace?: () => void;
  onClose?: () => void;
  embedded?: boolean;
  className?: string;
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
 * Session-cwd uncommitted review (desktop Review pane).
 * Uses agent-host ``/api/git/review/*`` — not Electron-local git.
 */
export function RightReviewPane({
  workspaceCwd,
  onOpenWorkspace,
  onClose,
  embedded = false,
  className,
}: RightReviewPaneProps) {
  const hasWorkspace = hasOpenWorkspace(workspaceCwd);
  const cwd = hasWorkspace ? workspaceCwd!.trim() : "";
  const review = useReview(cwd);
  const [commitMsg, setCommitMsg] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const selected = review.files.find((f) => f.path === review.selectedPath);

  if (!hasWorkspace) {
    return (
      <aside
        aria-label="Review"
        className={cn(
          "flex h-full w-full min-w-0 flex-col overflow-hidden",
          "border-l border-border/40 bg-background/80",
          className,
        )}
      >
        {!embedded && (
          <div className="flex h-8 shrink-0 items-center justify-between gap-1 border-b border-border/40 px-2.5">
            <span className="truncate text-xs font-medium text-foreground">
              Review
            </span>
            {onClose && (
              <Button
                type="button"
                size="icon"
                ghost
                className="h-6 w-6"
                aria-label="Hide review"
                onClick={onClose}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
        <EmptyState
          title="No project open"
          body="Open a project to review uncommitted changes."
          action={
            onOpenWorkspace ? (
              <Button type="button" size="sm" className="mt-1" onClick={onOpenWorkspace}>
                <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                Open project
              </Button>
            ) : undefined
          }
        />
      </aside>
    );
  }

  return (
    <aside
      aria-label="Review"
      className={cn(
        "flex h-full w-full min-w-0 flex-col overflow-hidden",
        "border-l border-border/40 bg-background/80 text-muted-foreground",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-8 shrink-0 items-center gap-0.5 px-2",
          "border-b border-border/40",
        )}
      >
        <GitBranch className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span
          className="min-w-0 flex-1 truncate px-0.5 text-xs font-medium text-foreground"
          title={cwd}
        >
          {workspaceLabel(cwd)}
        </span>
        <Button
          type="button"
          size="icon"
          ghost
          className="h-6 w-6"
          aria-label="Refresh review"
          disabled={review.loading}
          onClick={() => void review.refresh()}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", review.loading && "animate-spin")}
          />
        </Button>
        {!embedded && onClose && (
          <Button
            type="button"
            size="icon"
            ghost
            className="h-6 w-6"
            aria-label="Hide review"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {actionError && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-2 py-1 text-[0.65rem] text-destructive">
          {actionError}
        </div>
      )}

      {!review.isRepo && !review.loading ? (
        <EmptyState
          title="Not a git repo"
          body="This project folder is not inside a git repository."
        />
      ) : review.loading && review.files.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-xs">
          Loading changes…
        </div>
      ) : review.files.length === 0 ? (
        <EmptyState title="No diffs" body="Working tree is clean." />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {review.files.map((file) => {
              const active = file.path === review.selectedPath;
              return (
                <button
                  key={file.path}
                  type="button"
                  title={file.path}
                  className={cn(
                    "flex w-full items-center gap-1.5 px-2 py-1 text-left text-[0.7rem]",
                    "hover:bg-muted/60 hover:text-foreground",
                    active && "bg-muted text-foreground",
                  )}
                  onClick={() => review.selectFile(file)}
                >
                  <FileDiff className="h-3 w-3 shrink-0 opacity-70" />
                  <span className="min-w-0 flex-1 truncate">
                    {basename(file.path)}
                    {file.staged ? " · staged" : ""}
                  </span>
                  <span className="shrink-0 font-mono text-[0.65rem] text-emerald-600">
                    +{file.added}
                  </span>
                  <span className="shrink-0 font-mono text-[0.65rem] text-rose-600">
                    −{file.removed}
                  </span>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="flex max-h-[45%] min-h-[7rem] shrink-0 flex-col border-t border-border/40">
              <div className="flex h-7 shrink-0 items-center gap-1 px-2">
                <span
                  className="min-w-0 flex-1 truncate text-[0.7rem] text-foreground"
                  title={selected.path}
                >
                  {basename(selected.path)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  ghost
                  className="h-6 px-1.5 text-[0.65rem]"
                  disabled={review.shipBusy}
                  onClick={() => {
                    setActionError(null);
                    void (selected.staged
                      ? review.unstage(selected.path)
                      : review.stage(selected.path)
                    ).catch((e) =>
                      setActionError(
                        e instanceof Error ? e.message : "Stage failed",
                      ),
                    );
                  }}
                >
                  {selected.staged ? "Unstage" : "Stage"}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  ghost
                  className="h-6 w-6"
                  aria-label="Revert file"
                  disabled={review.shipBusy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Revert changes to ${basename(selected.path)}?`,
                      )
                    ) {
                      return;
                    }
                    setActionError(null);
                    void review.revert(selected.path).catch((e) =>
                      setActionError(
                        e instanceof Error ? e.message : "Revert failed",
                      ),
                    );
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  ghost
                  className="h-6 w-6"
                  aria-label="Close diff"
                  onClick={review.clearSelection}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-2 pb-2 font-mono text-[0.6rem] leading-relaxed text-foreground/90">
                {review.diffLoading
                  ? "Loading diff…"
                  : review.diff || "(empty diff)"}
              </pre>
            </div>
          )}

          <div className="shrink-0 border-t border-border/40 p-2">
            <textarea
              className="mb-1.5 h-14 w-full resize-none rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Commit message"
              value={commitMsg}
              disabled={review.shipBusy}
              onChange={(e) => setCommitMsg(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                disabled={review.shipBusy || !commitMsg.trim()}
                onClick={() => {
                  setActionError(null);
                  void review
                    .commit(commitMsg.trim(), false)
                    .then(() => setCommitMsg(""))
                    .catch((e) =>
                      setActionError(
                        e instanceof Error ? e.message : "Commit failed",
                      ),
                    );
                }}
              >
                Commit
              </Button>
              <Button
                type="button"
                size="sm"
                ghost
                className="h-7 text-xs"
                disabled={review.shipBusy || !commitMsg.trim()}
                onClick={() => {
                  setActionError(null);
                  void review
                    .commit(commitMsg.trim(), true)
                    .then(() => setCommitMsg(""))
                    .catch((e) =>
                      setActionError(
                        e instanceof Error ? e.message : "Commit & push failed",
                      ),
                    );
                }}
              >
                Commit & push
              </Button>
              <Button
                type="button"
                size="sm"
                ghost
                className="h-7 text-xs"
                disabled={review.shipBusy}
                onClick={() => {
                  setActionError(null);
                  void review.push().catch((e) =>
                    setActionError(
                      e instanceof Error ? e.message : "Push failed",
                    ),
                  );
                }}
              >
                Push
              </Button>
              {review.shipInfo.ghReady && (
                <Button
                  type="button"
                  size="sm"
                  ghost
                  className="h-7 text-xs"
                  disabled={review.shipBusy}
                  onClick={() => {
                    setActionError(null);
                    void review
                      .openOrCreatePr()
                      .then((url) => {
                        if (url) window.open(url, "_blank", "noopener");
                      })
                      .catch((e) =>
                        setActionError(
                          e instanceof Error ? e.message : "PR failed",
                        ),
                      );
                  }}
                >
                  {review.shipInfo.pr ? "Open PR" : "Create PR"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
