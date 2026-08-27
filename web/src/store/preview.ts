import { atom, computed } from "nanostores";

export interface PreviewTarget {
  binary?: boolean;
  byteSize?: number;
  dataUrl?: string;
  kind: "artifact" | "file" | "url";
  label: string;
  large?: boolean;
  language?: string;
  mimeType?: string;
  path?: string;
  previewKind?: "binary" | "html" | "image" | "pdf" | "text";
  renderMode?: "preview" | "source";
  source: string;
  transient?: boolean;
  url: string;
}

export type PreviewRecordSource =
  | "explicit-link"
  | "file-browser"
  | "manual"
  | "tool-result";

export interface PreviewTab {
  id: string;
  target: PreviewTarget;
}

export const $previewTabs = atom<PreviewTab[]>([]);

export const $previewTabSources = computed($previewTabs, (tabs) =>
  tabs.map((tab) => tab.target.source),
);

export function openPreview(
  _target: PreviewTarget,
  _source: PreviewRecordSource = "manual",
): void {}

export function closePreviewForSource(_source: string): boolean {
  return false;
}

export function closeRightRail(): void {}
