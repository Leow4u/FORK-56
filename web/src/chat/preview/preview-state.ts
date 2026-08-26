/** Thin-chat preview targets (desktop PreviewTarget subset). */

export type PreviewKind = "file" | "url";

export interface PreviewTarget {
  kind: PreviewKind;
  label: string;
  url: string;
  path?: string;
  source: string;
  mimeType?: string;
  language?: string;
  binary?: boolean;
  text?: string;
  dataUrl?: string;
}

export interface PreviewState {
  tabs: PreviewTarget[];
  activeIndex: number;
}

export const EMPTY_PREVIEW_STATE: PreviewState = {
  tabs: [],
  activeIndex: -1,
};

export function openPreviewTarget(
  state: PreviewState,
  target: PreviewTarget,
): PreviewState {
  const key =
    target.kind === "file"
      ? `file:${target.path || target.url}`
      : `url:${target.url}`;
  const existing = state.tabs.findIndex((t) => {
    const k =
      t.kind === "file" ? `file:${t.path || t.url}` : `url:${t.url}`;
    return k === key;
  });
  if (existing >= 0) {
    const tabs = [...state.tabs];
    tabs[existing] = { ...tabs[existing], ...target };
    return { tabs, activeIndex: existing };
  }
  return { tabs: [...state.tabs, target], activeIndex: state.tabs.length };
}

export function closePreviewAt(
  state: PreviewState,
  index: number,
): PreviewState {
  if (index < 0 || index >= state.tabs.length) return state;
  const tabs = state.tabs.filter((_, i) => i !== index);
  let activeIndex = state.activeIndex;
  if (tabs.length === 0) activeIndex = -1;
  else if (activeIndex >= tabs.length) activeIndex = tabs.length - 1;
  else if (activeIndex > index) activeIndex -= 1;
  return { tabs, activeIndex };
}

export function closeAllPreviews(): PreviewState {
  return { ...EMPTY_PREVIEW_STATE };
}

export function parsePreviewOpenPayload(
  payload: Record<string, unknown> | null | undefined,
): PreviewTarget | null {
  if (!payload) return null;
  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const path = typeof payload.path === "string" ? payload.path.trim() : "";
  const label =
    (typeof payload.label === "string" && payload.label.trim()) ||
    path.split(/[\\/]/).pop() ||
    url ||
    "Preview";
  if (url && (/^https?:\/\//i.test(url) || url.startsWith("data:"))) {
    return {
      kind: "url",
      label,
      url,
      source: "tool-result",
    };
  }
  const filePath = path || url;
  if (!filePath) return null;
  return {
    kind: "file",
    label,
    url: filePath,
    path: filePath,
    source: "tool-result",
  };
}
