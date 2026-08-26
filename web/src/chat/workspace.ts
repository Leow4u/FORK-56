/** Remembered workspace cwd for thin chat (desktop ``workspaceCwdKey`` analogue). */

const STORAGE_PREFIX = "work4you:thin-chat:workspace-cwd:";

export function workspaceStorageKey(profile?: string | null): string {
  const p = (profile || "default").trim() || "default";
  return `${STORAGE_PREFIX}${p}`;
}

export function readRememberedWorkspaceCwd(
  profile?: string | null,
): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(workspaceStorageKey(profile));
    const trimmed = raw?.trim() ?? "";
    return trimmed || null;
  } catch {
    return null;
  }
}

export function writeRememberedWorkspaceCwd(
  cwd: string | null,
  profile?: string | null,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    const key = workspaceStorageKey(profile);
    const trimmed = cwd?.trim() ?? "";
    if (!trimmed) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, trimmed);
  } catch {
    // ignore quota / private mode
  }
}

export function workspaceLabel(cwd: string | null | undefined): string {
  const trimmed = cwd?.trim() ?? "";
  if (!trimmed) return "No project open";
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || trimmed;
}

export function hasOpenWorkspace(cwd: string | null | undefined): boolean {
  return Boolean(cwd?.trim());
}
