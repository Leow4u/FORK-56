import { ChevronDown, ChevronRight, FileIcon, Folder, FolderOpen } from "lucide-react";
import { useCallback } from "react";

import { cn } from "@/lib/utils";

import type { TreeNode } from "./use-project-tree";

export interface ProjectTreeProps {
  collapseNonce: number;
  cwd: string;
  data: TreeNode[];
  openState: Record<string, boolean>;
  onActivateFile: (path: string) => void;
  onActivateFolder: (path: string) => void;
  onLoadChildren: (id: string) => void | Promise<void>;
  onNodeOpenChange: (id: string, open: boolean) => void;
  onPreviewFile?: (path: string) => void;
}

function TreeRow({
  node,
  depth,
  openState,
  onActivateFile,
  onActivateFolder,
  onLoadChildren,
  onNodeOpenChange,
  onPreviewFile,
}: {
  node: TreeNode;
  depth: number;
  openState: Record<string, boolean>;
  onActivateFile: (path: string) => void;
  onActivateFolder: (path: string) => void;
  onLoadChildren: (id: string) => void | Promise<void>;
  onNodeOpenChange: (id: string, open: boolean) => void;
  onPreviewFile?: (path: string) => void;
}) {
  const isOpen = Boolean(openState[node.id]);
  const isFolder = node.isDirectory;
  const paddingLeft = 8 + depth * 12;

  const toggle = useCallback(() => {
    if (!isFolder || node.placeholder) return;
    const next = !isOpen;
    onNodeOpenChange(node.id, next);
    if (next && node.children === undefined) {
      void onLoadChildren(node.id);
    }
  }, [isFolder, isOpen, node, onLoadChildren, onNodeOpenChange]);

  const activate = useCallback(() => {
    if (node.placeholder) return;
    if (isFolder) {
      onActivateFolder(node.id);
      if (!isOpen) toggle();
      return;
    }
    onActivateFile(node.id);
    onPreviewFile?.(node.id);
  }, [
    isFolder,
    isOpen,
    node,
    onActivateFile,
    onActivateFolder,
    onPreviewFile,
    toggle,
  ]);

  if (node.placeholder) {
    return (
      <div
        className="flex h-[22px] items-center truncate px-2 text-[0.7rem] text-muted-foreground/70"
        style={{ paddingLeft }}
      >
        {node.name}
      </div>
    );
  }

  const Icon = isFolder
    ? isOpen
      ? FolderOpen
      : Folder
    : FileIcon;

  return (
    <div>
      <button
        type="button"
        className={cn(
          "flex h-[22px] w-full min-w-0 items-center gap-1 rounded-sm px-1 text-left text-[0.75rem]",
          "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
        style={{ paddingLeft }}
        onClick={() => {
          if (isFolder) toggle();
          else activate();
        }}
        onDoubleClick={activate}
        title={node.id}
      >
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-muted-foreground/80">
          {isFolder ? (
            isOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : (
            <span className="w-3" />
          )}
        </span>
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
      </button>
      {isFolder && isOpen && (node.children?.length ?? 0) > 0 && (
        <div>
          {node.children!.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              openState={openState}
              onActivateFile={onActivateFile}
              onActivateFolder={onActivateFolder}
              onLoadChildren={onLoadChildren}
              onNodeOpenChange={onNodeOpenChange}
              onPreviewFile={onPreviewFile}
            />
          ))}
        </div>
      )}
      {isFolder && isOpen && node.loading && !node.children?.length && (
        <div
          className="px-2 text-[0.7rem] text-muted-foreground/70"
          style={{ paddingLeft: paddingLeft + 16 }}
        >
          Loading…
        </div>
      )}
    </div>
  );
}

export function ProjectTree({
  collapseNonce,
  cwd,
  data,
  openState,
  onActivateFile,
  onActivateFolder,
  onLoadChildren,
  onNodeOpenChange,
  onPreviewFile,
}: ProjectTreeProps) {
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1"
      data-project-tree=""
      data-cwd={cwd}
      key={`${cwd}:${collapseNonce}`}
    >
      {data.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          depth={0}
          openState={openState}
          onActivateFile={onActivateFile}
          onActivateFolder={onActivateFolder}
          onLoadChildren={onLoadChildren}
          onNodeOpenChange={onNodeOpenChange}
          onPreviewFile={onPreviewFile}
        />
      ))}
    </div>
  );
}
