import { useCallback, useEffect, useRef, useState } from "react";

import {
  readProjectDir,
  type ProjectTreeEntry,
} from "./fs-client";

export interface TreeNode {
  /** Absolute filesystem path — doubles as node id. */
  id: string;
  name: string;
  isDirectory: boolean;
  /** ``undefined`` = not loaded yet; ``[]`` = loaded empty. */
  children?: TreeNode[];
  loading?: boolean;
  placeholder?: "error" | "loading";
  error?: string;
}

function makeNode(path: string, name: string, isDirectory: boolean): TreeNode {
  return { id: path, isDirectory, name };
}

function patchNode(
  nodes: TreeNode[] | undefined | null,
  id: string,
  patch: (n: TreeNode) => TreeNode,
): TreeNode[] {
  if (!nodes) return [];
  return nodes.map((n) => {
    if (n.id === id) return patch(n);
    if (n.children && n.children.length > 0) {
      return { ...n, children: patchNode(n.children, id, patch) };
    }
    return n;
  });
}

function mergeChildren(
  existing: TreeNode[],
  entries: ProjectTreeEntry[],
): TreeNode[] {
  const byId = new Map(
    existing.filter((node) => !node.placeholder).map((node) => [node.id, node]),
  );
  return entries.map(
    (entry) =>
      byId.get(entry.path) ??
      makeNode(entry.path, entry.name, entry.isDirectory),
  );
}

function placeholderChild(parentId: string): TreeNode {
  return {
    id: `${parentId}::__loading__`,
    isDirectory: false,
    name: "Loading…",
    placeholder: "loading",
  };
}

function errorChild(parentId: string, error: string | undefined): TreeNode {
  return {
    id: `${parentId}::__error__`,
    isDirectory: false,
    name: `Unable to read (${error || "read-error"})`,
    placeholder: "error",
  };
}

export interface UseProjectTreeResult {
  collapseNonce: number;
  data: TreeNode[];
  effectiveCwd: string;
  openState: Record<string, boolean>;
  rootError: string | null;
  rootLoading: boolean;
  collapseAll: () => void;
  loadChildren: (id: string) => Promise<void>;
  refreshRoot: () => Promise<void>;
  setNodeOpen: (id: string, open: boolean) => void;
}

const ROOT_ERROR_RETRY_MS = 3_000;

/**
 * Lazy project tree for the session workspace cwd.
 * Instance-local (one chat surface) — not a process-wide atom.
 */
export function useProjectTree(cwd: string): UseProjectTreeResult {
  const [collapseNonce, setCollapseNonce] = useState(0);
  const [data, setData] = useState<TreeNode[]>([]);
  const [openState, setOpenState] = useState<Record<string, boolean>>({});
  const [rootError, setRootError] = useState<string | null>(null);
  const [rootLoading, setRootLoading] = useState(false);
  const [effectiveCwd, setEffectiveCwd] = useState("");
  const requestIdRef = useRef(0);
  const inflightRef = useRef(new Set<string>());
  const cwdRef = useRef(cwd);

  cwdRef.current = cwd;

  const refreshRoot = useCallback(async () => {
    const target = cwdRef.current.trim();
    const requestId = ++requestIdRef.current;
    inflightRef.current.clear();

    if (!target) {
      setData([]);
      setOpenState({});
      setRootError(null);
      setRootLoading(false);
      setEffectiveCwd("");
      return;
    }

    setRootLoading(true);
    setRootError(null);
    setData([]);
    setEffectiveCwd("");

    const { entries, error } = await readProjectDir(target);
    if (requestId !== requestIdRef.current || cwdRef.current.trim() !== target) {
      return;
    }

    if (error) {
      setData([]);
      setRootError(error);
      setRootLoading(false);
      setEffectiveCwd(target);
      return;
    }

    setData(entries.map((e) => makeNode(e.path, e.name, e.isDirectory)));
    setEffectiveCwd(target);
    setRootError(null);
    setRootLoading(false);
  }, []);

  useEffect(() => {
    void refreshRoot();
  }, [cwd, refreshRoot]);

  useEffect(() => {
    if (!rootError || !cwd.trim()) return;
    const timer = window.setTimeout(() => {
      void refreshRoot();
    }, ROOT_ERROR_RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [rootError, cwd, refreshRoot]);

  const loadChildren = useCallback(async (id: string) => {
    if (!id || inflightRef.current.has(id)) return;
    inflightRef.current.add(id);

    setData((prev) =>
      patchNode(prev, id, (n) => ({
        ...n,
        loading: true,
        children: n.children ?? [placeholderChild(id)],
      })),
    );

    const { entries, error } = await readProjectDir(id);
    inflightRef.current.delete(id);

    setData((prev) =>
      patchNode(prev, id, (n) => {
        if (error) {
          return {
            ...n,
            loading: false,
            error,
            children: [errorChild(id, error)],
          };
        }
        const existing = (n.children ?? []).filter((c) => !c.placeholder);
        return {
          ...n,
          loading: false,
          error: undefined,
          children: mergeChildren(existing, entries),
        };
      }),
    );
  }, []);

  const setNodeOpen = useCallback((id: string, open: boolean) => {
    setOpenState((prev) => {
      if (Boolean(prev[id]) === open) return prev;
      return { ...prev, [id]: open };
    });
  }, []);

  const collapseAll = useCallback(() => {
    setOpenState({});
    setCollapseNonce((n) => n + 1);
  }, []);

  return {
    collapseNonce,
    data,
    effectiveCwd: effectiveCwd || cwd.trim(),
    openState,
    rootError,
    rootLoading,
    collapseAll,
    loadChildren,
    refreshRoot,
    setNodeOpen,
  };
}
