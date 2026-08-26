import { api, type FsDirEntry, type FsListResponse, type FsReadTextResponse } from "@/lib/api";

import { filterExcludedEntries } from "./excluded-paths";

export type { FsDirEntry, FsListResponse, FsReadTextResponse };

export interface ProjectTreeEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export async function readProjectDir(dirPath: string): Promise<{
  entries: ProjectTreeEntry[];
  error?: string;
}> {
  const trimmed = dirPath.trim();
  if (!trimmed) {
    return { entries: [], error: "ENOENT" };
  }

  let result: FsListResponse;
  try {
    result = await api.listFsDir(trimmed);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err ?? "read-error");
    return { entries: [], error: message || "read-error" };
  }

  if (result.error) {
    return { entries: [], error: result.error };
  }

  const entries = filterExcludedEntries(result.entries ?? []).map((entry) => ({
    name: entry.name,
    path: entry.path,
    isDirectory: Boolean(entry.isDirectory),
  }));

  return { entries };
}

export async function readProjectFileText(path: string): Promise<FsReadTextResponse> {
  return api.readFsText(path);
}
