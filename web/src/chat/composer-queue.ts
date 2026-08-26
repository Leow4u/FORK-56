/** Queued composer drafts (desktop composer-queue contract, thin-chat). */

import type { ThinComposerAttachment } from "./attachments";

export interface QueuedPromptEntry {
  id: string;
  text: string;
  displayText: string;
  attachments: ThinComposerAttachment[];
  createdAt: number;
}

export function createQueuedPromptId(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeQueuedEntry(input: {
  text: string;
  displayText?: string;
  attachments?: ThinComposerAttachment[];
}): QueuedPromptEntry {
  const text = input.text;
  const attachments = input.attachments ? [...input.attachments] : [];
  return {
    id: createQueuedPromptId(),
    text,
    displayText: (input.displayText ?? text).trim() || text,
    attachments,
    createdAt: Date.now(),
  };
}

export function isSteerableEntry(entry: QueuedPromptEntry): boolean {
  const trimmed = entry.text.trim();
  if (!trimmed || trimmed.startsWith("/")) return false;
  if (entry.attachments.length > 0) return false;
  return true;
}

export function queuePreview(entry: QueuedPromptEntry): string {
  const text = (entry.displayText || entry.text).trim();
  if (text) return text;
  if (entry.attachments.length > 0) {
    return `${entry.attachments.length} attachment${entry.attachments.length === 1 ? "" : "s"}`;
  }
  return "(empty)";
}
