import { atom } from "nanostores";

export interface ArtifactEntry {
  id: string;
  sessionId: string;
  path: string;
  label: string;
  kind?: string;
  previewTarget?: string;
}

const registry = atom<Record<string, ArtifactEntry[]>>({});

export const $artifactRegistry = registry;

export function artifactsForSession(sessionId: string): ArtifactEntry[] {
  return registry.get()[sessionId] ?? [];
}

export function clearArtifactRegistry(): void {
  registry.set({});
}

export function upsertArtifact(entry: ArtifactEntry): void {
  const current = registry.get();
  const list = current[entry.sessionId] ?? [];
  const idx = list.findIndex((a) => a.id === entry.id);
  const next =
    idx >= 0
      ? list.map((a, i) => (i === idx ? { ...a, ...entry } : a))
      : [...list, entry];
  registry.set({ ...current, [entry.sessionId]: next });
}

export function openArtifact(_entry: ArtifactEntry): void {}
