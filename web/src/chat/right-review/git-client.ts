import { api, type GitReviewFile, type GitReviewShipInfo } from "@/lib/api";

import { ALWAYS_EXCLUDED } from "../right-files/excluded-paths";

export type { GitReviewFile, GitReviewShipInfo };

export function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

export async function listReviewFiles(cwd: string): Promise<{
  files: GitReviewFile[];
  base: string | null;
  isRepo: boolean;
  error?: string;
}> {
  const trimmed = cwd.trim();
  if (!trimmed) {
    return { files: [], base: null, isRepo: false };
  }
  try {
    const status = await api.gitRepoStatus(trimmed);
    if (!status) {
      return { files: [], base: null, isRepo: false };
    }
    const result = await api.gitReviewList(trimmed, "uncommitted");
    const files = (result.files ?? []).filter((f) => {
      const parts = f.path.split(/[\\/]/).filter(Boolean);
      return !parts.some((part) => ALWAYS_EXCLUDED.has(part));
    });
    return {
      files,
      base: result.base ?? null,
      isRepo: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not a git|not a repo|fatal:/i.test(message)) {
      return { files: [], base: null, isRepo: false };
    }
    return { files: [], base: null, isRepo: false, error: message };
  }
}

export async function loadReviewDiff(
  cwd: string,
  file: string,
  staged: boolean,
): Promise<string> {
  const result = await api.gitReviewDiff(cwd, file, {
    scope: "uncommitted",
    staged,
  });
  return result.diff ?? "";
}

export async function stageReviewFile(cwd: string, file: string) {
  return api.gitReviewStage(cwd, file);
}

export async function unstageReviewFile(cwd: string, file: string) {
  return api.gitReviewUnstage(cwd, file);
}

export async function revertReviewFile(cwd: string, file: string | null) {
  return api.gitReviewRevert(cwd, file);
}

export async function commitReview(
  cwd: string,
  message: string,
  push: boolean,
) {
  return api.gitReviewCommit(cwd, message, push);
}

export async function pushReview(cwd: string) {
  return api.gitReviewPush(cwd);
}

export async function fetchShipInfo(cwd: string): Promise<GitReviewShipInfo> {
  try {
    return await api.gitReviewShipInfo(cwd);
  } catch {
    return { ghReady: false, pr: null };
  }
}

export async function createReviewPr(cwd: string) {
  return api.gitReviewCreatePr(cwd);
}
