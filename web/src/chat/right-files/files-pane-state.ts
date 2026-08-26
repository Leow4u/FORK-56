/** Persist whether the thin-chat right Files pane is open. */

const STORAGE_PREFIX = "work4you:thin-chat:files-pane-open:";

export function filesPaneStorageKey(profile?: string | null): string {
  const p = (profile || "default").trim() || "default";
  return `${STORAGE_PREFIX}${p}`;
}

export function readFilesPaneOpen(profile?: string | null): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const raw = localStorage.getItem(filesPaneStorageKey(profile));
    if (raw === null) return true; // default open once workspace exists
    return raw === "1" || raw === "true";
  } catch {
    return true;
  }
}

export function writeFilesPaneOpen(
  open: boolean,
  profile?: string | null,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(filesPaneStorageKey(profile), open ? "1" : "0");
  } catch {
    // ignore
  }
}
