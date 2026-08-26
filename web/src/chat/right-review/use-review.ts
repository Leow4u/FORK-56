import { useCallback, useEffect, useRef, useState } from "react";

import type { GitReviewFile, GitReviewShipInfo } from "./git-client";
import {
  commitReview,
  createReviewPr,
  fetchShipInfo,
  listReviewFiles,
  loadReviewDiff,
  pushReview,
  revertReviewFile,
  stageReviewFile,
  unstageReviewFile,
} from "./git-client";

export interface UseReviewResult {
  files: GitReviewFile[];
  loading: boolean;
  isRepo: boolean;
  error: string | null;
  selectedPath: string | null;
  diff: string | null;
  diffLoading: boolean;
  shipInfo: GitReviewShipInfo;
  shipBusy: boolean;
  selectFile: (file: GitReviewFile) => void;
  clearSelection: () => void;
  refresh: () => Promise<void>;
  stage: (path: string) => Promise<void>;
  unstage: (path: string) => Promise<void>;
  revert: (path: string | null) => Promise<void>;
  commit: (message: string, push: boolean) => Promise<void>;
  push: () => Promise<void>;
  openOrCreatePr: () => Promise<string | null>;
}

export function useReview(cwd: string): UseReviewResult {
  const [files, setFiles] = useState<GitReviewFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRepo, setIsRepo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [shipInfo, setShipInfo] = useState<GitReviewShipInfo>({
    ghReady: false,
    pr: null,
  });
  const [shipBusy, setShipBusy] = useState(false);
  const seqRef = useRef(0);
  const cwdRef = useRef(cwd);
  cwdRef.current = cwd;

  const refresh = useCallback(async () => {
    const target = cwdRef.current.trim();
    const seq = ++seqRef.current;
    if (!target) {
      setFiles([]);
      setIsRepo(false);
      setError(null);
      setLoading(false);
      setSelectedPath(null);
      setDiff(null);
      setShipInfo({ ghReady: false, pr: null });
      return;
    }
    setLoading(true);
    setError(null);
    const result = await listReviewFiles(target);
    if (seq !== seqRef.current || cwdRef.current.trim() !== target) return;
    setIsRepo(result.isRepo);
    setFiles(result.files);
    setError(result.error ?? null);
    setLoading(false);
    if (result.isRepo) {
      void fetchShipInfo(target).then((info) => {
        if (seq === seqRef.current) setShipInfo(info);
      });
    }
    setSelectedPath((prev) => {
      if (!prev) return prev;
      return result.files.some((f) => f.path === prev) ? prev : null;
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [cwd, refresh]);

  const selectFile = useCallback(
    (file: GitReviewFile) => {
      setSelectedPath(file.path);
      setDiffLoading(true);
      setDiff(null);
      const target = cwdRef.current.trim();
      void loadReviewDiff(target, file.path, file.staged)
        .then((text) => {
          if (cwdRef.current.trim() !== target) return;
          setDiff(text);
        })
        .catch((err) => {
          setDiff(
            err instanceof Error ? `// ${err.message}` : "// Diff unavailable",
          );
        })
        .finally(() => setDiffLoading(false));
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setSelectedPath(null);
    setDiff(null);
  }, []);

  const stage = useCallback(
    async (path: string) => {
      await stageReviewFile(cwdRef.current, path);
      await refresh();
    },
    [refresh],
  );

  const unstage = useCallback(
    async (path: string) => {
      await unstageReviewFile(cwdRef.current, path);
      await refresh();
    },
    [refresh],
  );

  const revert = useCallback(
    async (path: string | null) => {
      await revertReviewFile(cwdRef.current, path);
      clearSelection();
      await refresh();
    },
    [clearSelection, refresh],
  );

  const commit = useCallback(
    async (message: string, push: boolean) => {
      setShipBusy(true);
      try {
        await commitReview(cwdRef.current, message, push);
        clearSelection();
        await refresh();
      } finally {
        setShipBusy(false);
      }
    },
    [clearSelection, refresh],
  );

  const push = useCallback(async () => {
    setShipBusy(true);
    try {
      await pushReview(cwdRef.current);
      await refresh();
    } finally {
      setShipBusy(false);
    }
  }, [refresh]);

  const openOrCreatePr = useCallback(async () => {
    setShipBusy(true);
    try {
      if (shipInfo.pr?.url) return shipInfo.pr.url;
      const result = await createReviewPr(cwdRef.current);
      await refresh();
      return result.url ?? null;
    } finally {
      setShipBusy(false);
    }
  }, [refresh, shipInfo.pr?.url]);

  return {
    files,
    loading,
    isRepo,
    error,
    selectedPath,
    diff,
    diffLoading,
    shipInfo,
    shipBusy,
    selectFile,
    clearSelection,
    refresh,
    stage,
    unstage,
    revert,
    commit,
    push,
    openOrCreatePr,
  };
}
